// ocr.swift — macOS Vision OCR helper used by the VIKC user-guide conversion pipeline.
//
// Usage:
//   swift ocr.swift --lang vi-VN --out out.json image1.png [image2.png ...]
//
// Emits JSON to --out (or stdout) of the shape:
//   [ { "file": "...", "lines": [ { "text": "...", "confidence": 0.99,
//        "x": 0.1, "y": 0.2, "w": 0.8, "h": 0.03 } ] } ]
// Coordinates are normalized (0..1) with the origin at the TOP-LEFT so the
// output reads naturally top-to-bottom.

import Foundation
import Vision
import CoreGraphics
import ImageIO

struct Line: Codable {
    let text: String
    let confidence: Double
    let x: Double
    let y: Double
    let w: Double
    let h: Double
}

struct PageResult: Codable {
    let file: String
    let lines: [Line]
}

func fail(_ message: String) -> Never {
    FileHandle.standardError.write(("error: " + message + "\n").data(using: .utf8)!)
    exit(1)
}

var args = Array(CommandLine.arguments.dropFirst())
var languages: [String] = ["vi-VN", "en-US"]
var outputPath: String? = nil
var inputs: [String] = []
var fast = false

var i = 0
while i < args.count {
    switch args[i] {
    case "--lang":
        i += 1
        if i < args.count { languages = args[i].split(separator: ",").map(String.init) }
    case "--out":
        i += 1
        if i < args.count { outputPath = args[i] }
    case "--fast":
        fast = true
    default:
        inputs.append(args[i])
    }
    i += 1
}

if inputs.isEmpty { fail("no input images given") }

func loadImage(_ path: String) -> CGImage {
    let url = URL(fileURLWithPath: path)
    guard let src = CGImageSourceCreateWithURL(url as CFURL, nil),
          let img = CGImageSourceCreateImageAtIndex(src, 0, nil) else {
        fail("cannot read image: \(path)")
    }
    return img
}

var results: [PageResult] = []

for path in inputs {
    let image = loadImage(path)
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = fast ? .fast : .accurate
    request.recognitionLanguages = languages
    request.usesLanguageCorrection = true

    let handler = VNImageRequestHandler(cgImage: image, options: [:])
    do {
        try handler.perform([request])
    } catch {
        fail("vision request failed for \(path): \(error)")
    }

    var lines: [Line] = []
    if let observations = request.results {
        for obs in observations {
            guard let candidate = obs.topCandidates(1).first else { continue }
            // Vision uses a bottom-left origin; flip to top-left.
            let bb = obs.boundingBox
            lines.append(
                Line(
                    text: candidate.string,
                    confidence: Double(candidate.confidence),
                    x: Double(bb.minX),
                    y: Double(1.0 - bb.maxY),
                    w: Double(bb.width),
                    h: Double(bb.height)
                )
            )
        }
    }
    // Reading order: top-to-bottom, then left-to-right.
    lines.sort { a, b in
        if abs(a.y - b.y) > 0.012 { return a.y < b.y }
        return a.x < b.x
    }
    results.append(PageResult(file: path, lines: lines))
}

let encoder = JSONEncoder()
encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
let data = try! encoder.encode(results)

if let out = outputPath {
    try! data.write(to: URL(fileURLWithPath: out))
} else {
    FileHandle.standardOutput.write(data)
}
