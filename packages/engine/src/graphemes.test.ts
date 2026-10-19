import { describe, expect, it } from "vitest";
import { graphemes } from "./elements";

describe("graphemes", () => {
  it("keeps Devanagari syllables whole (consonant + vowel sign, conjuncts)", () => {
    // कि = क + ि ; क्ष = क + ् + ष ; a code-point split would give 6 pieces
    expect(graphemes("किक्ष")).toEqual(["कि", "क्ष"]);
    expect(graphemes("गुस्सा").join("")).toBe("गुस्सा");
    expect(graphemes("गुस्सा").length).toBeLessThan([..."गुस्सा"].length);
  });
  it("splits Latin text into letters as before", () => {
    expect(graphemes("Taste")).toEqual(["T", "a", "s", "t", "e"]);
  });
});
