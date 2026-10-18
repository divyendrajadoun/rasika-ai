import { StyleTokens } from "./style";
import mikkuRoyal from "../presets/mikku-royal.json";
import katanaPop from "../presets/katana-pop.json";
import noirMinimal from "../presets/noir-minimal.json";
import boldCreator from "../presets/bold-creator.json";
import boardroomNavy from "../presets/boardroom-navy.json";
import brutalistAcid from "../presets/brutalist-acid.json";
import cinemaBebas from "../presets/cinema-bebas.json";
import clinicClean from "../presets/clinic-clean.json";
import creatorYellow from "../presets/creator-yellow.json";
import editorialIvory from "../presets/editorial-ivory.json";
import festiveBandhani from "../presets/festive-bandhani.json";
import neonPop from "../presets/neon-pop.json";
import paperCollage from "../presets/paper-collage.json";
import sageWellness from "../presets/sage-wellness.json";
import kineticMono from "../presets/kinetic-mono.json";
import whiteboardMarker from "../presets/whiteboard-marker.json";
import chalkboardMaths from "../presets/chalkboard-maths.json";
import hypeCut from "../presets/hype-cut.json";
import launchSpotlight from "../presets/launch-spotlight.json";
import slamNeon from "../presets/slam-neon.json";
import spotlightPromo from "../presets/spotlight-promo.json";
import showreelBlocks from "../presets/showreel-blocks.json";
import brandBar from "../presets/brand-bar.json";
import beatType from "../presets/beat-type.json";
import motionmaxxed from "../presets/motionmaxxed.json";
import skyCards from "../presets/sky-cards.json";

/** The shipped presets, validated once at module load so a bad JSON fails fast. */
export const presets: readonly StyleTokens[] = [
  mikkuRoyal,
  katanaPop,
  noirMinimal,
  boldCreator,
  boardroomNavy,
  brutalistAcid,
  cinemaBebas,
  clinicClean,
  creatorYellow,
  editorialIvory,
  festiveBandhani,
  neonPop,
  paperCollage,
  sageWellness,
  kineticMono,
  whiteboardMarker,
  chalkboardMaths,
  hypeCut,
  launchSpotlight,
  slamNeon,
  spotlightPromo,
  showreelBlocks,
  brandBar,
  beatType,
  motionmaxxed,
  skyCards,
].map((p) => StyleTokens.parse(p));

export const defaultPreset: StyleTokens = presets[0] as StyleTokens;

/** Preset ids in display order (default first). */
export const presetIds = presets.map((p) => p.id);
