import { StyleTokens } from "./style";
import mikkuRoyal from "../presets/mikku-royal.json";
import katanaPop from "../presets/katana-pop.json";
import noirMinimal from "../presets/noir-minimal.json";
import boldCreator from "../presets/bold-creator.json";

/** The shipped presets, validated once at module load so a bad JSON fails fast. */
export const presets: readonly StyleTokens[] = [
  mikkuRoyal,
  katanaPop,
  noirMinimal,
  boldCreator,
].map((p) => StyleTokens.parse(p));

export const defaultPreset: StyleTokens = presets[0] as StyleTokens;
