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
import cinemaNavy from "../presets/cinema-navy.json";
import podcastOnAir from "../presets/podcast-on-air.json";
import impactoBoard from "../presets/impacto-board.json";
import nativoClean from "../presets/nativo-clean.json";
import revista from "../presets/revista.json";
import thrillerCctv from "../presets/thriller-cctv.json";
import missaoSunset from "../presets/missao-sunset.json";
import windowFacecam from "../presets/window-facecam.json";
import tabloidHeadline from "../presets/tabloid-headline.json";
import viewfinder from "../presets/viewfinder.json";
import paperExplainer from "../presets/paper-explainer.json";
import zineCollage from "../presets/zine-collage.json";
import vibeLife from "../presets/vibe-life.json";
import kineticEditorial from "../presets/kinetic-editorial.json";
import craftKraft from "../presets/craft-kraft.json";
import cyberLime from "../presets/cyber-lime.json";
import papercut from "../presets/papercut.json";
import halftoneCollage from "../presets/halftone-collage.json";
import retroTerminal from "../presets/retro-terminal.json";
import pixelRpg from "../presets/pixel-rpg.json";
import paperManuscript from "../presets/paper-manuscript.json";
import ohneis from "../presets/ohneis.json";
import porcelainKeynote from "../presets/porcelain-keynote.json";
import paperBlue from "../presets/paper-blue.json";
import aiStudio from "../presets/ai-studio.json";
import oneshotPaper from "../presets/oneshot-paper.json";
import morphCanvas from "../presets/morph-canvas.json";
import highEnergy from "../presets/high-energy.json";
import darkIos from "../presets/dark-ios.json";
import navyFoil from "../presets/navy-foil.json";
import inemaAmber from "../presets/inema-amber.json";
import darkStat from "../presets/dark-stat.json";
import memoPop from "../presets/memo-pop.json";
import boldAd from "../presets/bold-ad.json";
import premiumSerif from "../presets/premium-serif.json";
import funPop from "../presets/fun-pop.json";
import brewCards from "../presets/brew-cards.json";
import piLight from "../presets/pi-light.json";
import warmPaper from "../presets/warm-paper.json";
import handdrawnNotes from "../presets/handdrawn-notes.json";
import comicPop from "../presets/comic-pop.json";
import guofengPaper from "../presets/guofeng-paper.json";
import swissPoster from "../presets/swiss-poster.json";
import neonHud from "../presets/neon-hud.json";
import glassViolet from "../presets/glass-violet.json";
import paperGrid from "../presets/paper-grid.json";
import breakoutCard from "../presets/breakout-card.json";
import visualJournalism from "../presets/visual-journalism.json";
import kolasePaper from "../presets/kolase-paper.json";
import vintageSketch from "../presets/vintage-sketch.json";
import glassKeynote from "../presets/glass-keynote.json";
import multiverseComic from "../presets/multiverse-comic.json";
import lignePaper from "../presets/ligne-paper.json";
import voxDoc from "../presets/vox-doc.json";
import blackGoldBrief from "../presets/black-gold-brief.json";
import pencilNotes from "../presets/pencil-notes.json";
import neonCyber from "../presets/neon-cyber.json";
import museumDoc from "../presets/museum-doc.json";
import ghostClean from "../presets/ghost-clean.json";
import ghostEditorial from "../presets/ghost-editorial.json";
import ghostCinematic from "../presets/ghost-cinematic.json";
import ghostLaunch from "../presets/ghost-launch.json";
import ghostKinetic from "../presets/ghost-kinetic.json";
import ghostPop from "../presets/ghost-pop.json";
import palavra from "../presets/palavra.json";
import kurguInk from "../presets/kurgu-ink.json";
import voxPaper from "../presets/vox-paper.json";
import saasLaunch from "../presets/saas-launch.json";
import showreelKinetic from "../presets/showreel-kinetic.json";
import recipeExplainer from "../presets/recipe-explainer.json";
import versusArcade from "../presets/versus-arcade.json";
import musicMachine from "../presets/music-machine.json";
import grandBudapest from "../presets/grand-budapest.json";
import punchyFun from "../presets/punchy-fun.json";
import animateStudio from "../presets/animate-studio.json";
import kurzExplainer from "../presets/kurz-explainer.json";
import cutPaperVivid from "../presets/cut-paper-vivid.json";
import paperCutRed from "../presets/paper-cut-red.json";
import cleanCutMono from "../presets/clean-cut-mono.json";
import tierList from "../presets/tier-list.json";
import podcastGlow from "../presets/podcast-glow.json";

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
  cinemaNavy,
  podcastOnAir,
  impactoBoard,
  nativoClean,
  revista,
  thrillerCctv,
  missaoSunset,
  windowFacecam,
  tabloidHeadline,
  viewfinder,
  paperExplainer,
  zineCollage,
  vibeLife,
  kineticEditorial,
  craftKraft,
  cyberLime,
  papercut,
  halftoneCollage,
  retroTerminal,
  pixelRpg,
  paperManuscript,
  ohneis,
  porcelainKeynote,
  paperBlue,
  aiStudio,
  oneshotPaper,
  morphCanvas,
  highEnergy,
  darkIos,
  navyFoil,
  inemaAmber,
  darkStat,
  memoPop,
  boldAd,
  premiumSerif,
  funPop,
  brewCards,
  piLight,
  warmPaper,
  handdrawnNotes,
  comicPop,
  guofengPaper,
  swissPoster,
  neonHud,
  glassViolet,
  paperGrid,
  breakoutCard,
  visualJournalism,
  kolasePaper,
  vintageSketch,
  glassKeynote,
  multiverseComic,
  lignePaper,
  voxDoc,
  blackGoldBrief,
  pencilNotes,
  neonCyber,
  museumDoc,
  ghostClean,
  ghostEditorial,
  ghostCinematic,
  ghostLaunch,
  ghostKinetic,
  ghostPop,
  palavra,
  kurguInk,
  voxPaper,
  saasLaunch,
  showreelKinetic,
  recipeExplainer,
  versusArcade,
  musicMachine,
  grandBudapest,
  punchyFun,
  animateStudio,
  kurzExplainer,
  cutPaperVivid,
  paperCutRed,
  cleanCutMono,
  tierList,
  podcastGlow,
].map((p) => StyleTokens.parse(p));

export const defaultPreset: StyleTokens = presets[0] as StyleTokens;

/** Preset ids in display order (default first). */
export const presetIds = presets.map((p) => p.id);
