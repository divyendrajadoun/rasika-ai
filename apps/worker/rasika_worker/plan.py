"""
Plan v1 pydantic models — GENERATED from packages/schema/plan.schema.json by tools/gen_plan_models.py.
Do not edit by hand; change the Zod schema in packages/schema/src/plan.ts and regenerate.
"""

from __future__ import annotations

from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, Field, RootModel


class PlanMeta(BaseModel):
    durationSec: float = Field(..., gt=0.0, le=600.0)
    fps: Literal[30]
    width: Literal[1080]
    height: Literal[1920]
    language: str = Field(..., description="'en' | 'hi' | 'hinglish' | BCP-47 tag", min_length=2)
    faceless: bool | None = None


class Fonts(BaseModel):
    poster: str
    accent: str
    ui: str
    devanagari: str
    caption: str


class CaptionStyle(StrEnum):
    one_word = "one-word"
    phrase = "phrase"
    karaoke = "karaoke"
    box = "box"
    clean = "clean"
    off = "off"


class CaptionAccent(StrEnum):
    gold = "gold"
    goldd = "goldd"
    ter = "ter"
    mar = "mar"
    iv = "iv"


class EndCardShape(StrEnum):
    arch = "arch"
    rounded = "rounded"
    square = "square"


class Pattern(StrEnum):
    jaali = "jaali"
    arches = "arches"
    bandhani = "bandhani"
    leheriya = "leheriya"
    none = "none"


class Family(StrEnum):
    editorial = "editorial"
    kinetic = "kinetic"
    whiteboard = "whiteboard"
    chalk = "chalk"
    hype = "hype"
    launch = "launch"
    collage = "collage"
    blocks = "blocks"
    beat = "beat"


class CaseStyle(StrEnum):
    auto = "auto"
    upper = "upper"
    sentence = "sentence"


class Enter(StrEnum):
    rise = "rise"
    pop = "pop"
    slam = "slam"
    slide = "slide"
    fade = "fade"
    draw = "draw"
    blur = "blur"
    letters = "letters"
    mask = "mask"
    type = "type"


class Exit(StrEnum):
    lift = "lift"
    dive = "dive"
    cut = "cut"
    wipe = "wipe"
    fade = "fade"


class Easing(StrEnum):
    spring = "spring"
    snap = "snap"
    smooth = "smooth"
    soft = "soft"
    steps = "steps"


class Camera(StrEnum):
    glide = "glide"
    cut = "cut"
    whip = "whip"
    still = "still"
    push = "push"


class SfxKit(StrEnum):
    pop = "pop"
    click = "click"
    marker = "marker"
    chalk = "chalk"
    hype = "hype"
    cinematic = "cinematic"
    none = "none"


class Texture(StrEnum):
    none = "none"
    paper = "paper"
    board = "board"
    grid = "grid"
    dots = "dots"
    vignette = "vignette"
    gradient = "gradient"
    halftone = "halftone"
    scan = "scan"
    lines = "lines"
    grain = "grain"


class Framing(StrEnum):
    any = "any"
    full = "full"
    framed = "framed"


class Motion(BaseModel):
    family: Family | None = "editorial"
    caseStyle: CaseStyle | None = "auto"
    enter: Enter | None = "rise"
    exit: Exit | None = "lift"
    easing: Easing | None = "spring"
    speed: float | None = Field(1, ge=0.5, le=1.6)
    camera: Camera | None = "glide"
    sfxKit: SfxKit | None = "pop"
    texture: Texture | None = "none"
    direction: str | None = Field("", max_length=4000)
    avoidElements: list[str] | None = []
    framing: Framing | None = "any"


class Palette(BaseModel):
    stage: str = Field(..., pattern="^#[0-9a-fA-F]{6}$")
    mar: str = Field(..., pattern="^#[0-9a-fA-F]{6}$")
    ter: str = Field(..., pattern="^#[0-9a-fA-F]{6}$")
    gold: str = Field(..., pattern="^#[0-9a-fA-F]{6}$")
    goldd: str = Field(..., pattern="^#[0-9a-fA-F]{6}$")
    iv: str = Field(..., pattern="^#[0-9a-fA-F]{6}$")
    ink: str = Field(..., pattern="^#[0-9a-fA-F]{6}$")


class Rect(BaseModel):
    x: float = Field(..., ge=-4000.0, le=4000.0)
    y: float = Field(..., ge=-4000.0, le=4000.0)
    w: float = Field(..., ge=0.0, le=4000.0)
    h: float = Field(..., ge=0.0, le=4000.0)


class Point(BaseModel):
    x: float = Field(..., ge=-4000.0, le=4000.0)
    y: float = Field(..., ge=-4000.0, le=4000.0)


class VideoModeName(StrEnum):
    full = "full"
    zoom = "zoom"
    card = "card"
    pip = "pip"
    arch = "arch"


class Captions(BaseModel):
    enabled: bool | None = True
    y: float | None = Field(1400, ge=-4000.0, le=4000.0)
    gold: list[str] | None = Field([], description="emotion / theme words → gold serif italic")
    accent: list[str] | None = Field([], description="nouns, names, numbers → terracotta Anton")


class Source(BaseModel):
    provider: Literal["pexels"]
    id: int = Field(..., ge=-9007199254740991, le=9007199254740991)
    url: str
    author: str
    file: str | None = None
    duration: float | None = None


class PlanElement1(BaseModel):
    id: str = Field(..., max_length=64, min_length=1)
    t0: float = Field(..., ge=0.0, le=600.0)
    t1: float = Field(..., ge=0.0, le=600.0)
    anchorWordIndex: int | None = Field(None, ge=0, le=9007199254740991)
    type: Literal["broll"]
    query: str = Field(..., max_length=80, min_length=3)
    label: str | None = Field(None, max_length=40)
    source: Source | None = None


class Anim(StrEnum):
    rise = "rise"
    pop = "pop"


class Align(StrEnum):
    left = "left"
    center = "center"
    right = "right"


class Accent(StrEnum):
    """
    sfx hint for this line
    """

    glitch = "glitch"
    sub = "sub"


class TextFont(StrEnum):
    anton = "anton"
    serif = "serif"
    kicker = "kicker"
    devanagari = "devanagari"


class ColorToken(StrEnum):
    mar = "mar"
    ter = "ter"
    gold = "gold"
    goldd = "goldd"
    iv = "iv"
    stage = "stage"
    ink = "ink"


class Counter(BaseModel):
    id: str = Field(..., max_length=64, min_length=1)
    t0: float = Field(..., ge=0.0, le=600.0)
    t1: float = Field(..., ge=0.0, le=600.0)
    anchorWordIndex: int | None = Field(None, ge=0, le=9007199254740991)
    type: Literal["counter"]
    from_: float = Field(..., alias="from")
    to: float
    label: str = Field(..., max_length=40)
    top: float | None = Field(215, ge=-4000.0, le=4000.0)
    size: int | None = Field(250, ge=60, le=320)
    duration: float | None = Field(1, ge=0.2, le=5.0)
    color: ColorToken | None = None


class LockCard(BaseModel):
    id: str = Field(..., max_length=64, min_length=1)
    t0: float = Field(..., ge=0.0, le=600.0)
    t1: float = Field(..., ge=0.0, le=600.0)
    anchorWordIndex: int | None = Field(None, ge=0, le=9007199254740991)
    type: Literal["lockCard"]
    word: str = Field(..., max_length=24, min_length=1)
    kicker: str | None = Field("THE WORD", max_length=40)
    sub: str = Field(..., max_length=40)
    blurred: bool | None = True
    dark: bool | None = Field(False, description="dark variant for the payoff on the stage")


class Ring(BaseModel):
    cx: float = Field(..., ge=-4000.0, le=4000.0)
    cy: float = Field(..., ge=-4000.0, le=4000.0)
    rx: float = Field(..., ge=10.0, le=4000.0)
    ry: float = Field(..., ge=10.0, le=4000.0)


class PropPunchIn(BaseModel):
    id: str = Field(..., max_length=64, min_length=1)
    t0: float = Field(..., ge=0.0, le=600.0)
    t1: float = Field(..., ge=0.0, le=600.0)
    anchorWordIndex: int | None = Field(None, ge=0, le=9007199254740991)
    type: Literal["propPunchIn"]
    label: str = Field(..., max_length=40, min_length=1)
    ring: Ring
    labelTop: float | None = Field(600, ge=-4000.0, le=4000.0)


class PostDay(RootModel[int]):
    root: int = Field(..., ge=-9007199254740991, le=9007199254740991)


class FeedPhone(BaseModel):
    id: str = Field(..., max_length=64, min_length=1)
    t0: float = Field(..., ge=0.0, le=600.0)
    t1: float = Field(..., ge=0.0, le=600.0)
    anchorWordIndex: int | None = Field(None, ge=0, le=9007199254740991)
    type: Literal["feedPhone"]
    imageId: str = Field(..., max_length=64, min_length=1)
    posts: int | None = Field(10, ge=3, le=14)
    dayFrom: int | None = Field(1, ge=0, le=9007199254740991)
    dayTo: int | None = Field(30, ge=1, le=9007199254740991)
    postDays: list[PostDay] | None = Field(None, description="explicit per-post day labels")
    handle: str | None = Field("trending.jewels", max_length=32)
    postCaption: str | None = Field("you saw this again", max_length=60)
    title: str | None = Field("ON YOUR FEED", max_length=40)
    dayLabel: str | None = Field("DAY", max_length=12)


class Stamp(BaseModel):
    id: str = Field(..., max_length=64, min_length=1)
    t0: float = Field(..., ge=0.0, le=600.0)
    t1: float = Field(..., ge=0.0, le=600.0)
    anchorWordIndex: int | None = Field(None, ge=0, le=9007199254740991)
    type: Literal["stamp"]
    text: str = Field(..., max_length=24, min_length=1)


class ChapterCard(BaseModel):
    id: str = Field(..., max_length=64, min_length=1)
    t0: float = Field(..., ge=0.0, le=600.0)
    t1: float = Field(..., ge=0.0, le=600.0)
    anchorWordIndex: int | None = Field(None, ge=0, le=9007199254740991)
    type: Literal["chapterCard"]
    number: str = Field(..., max_length=4, min_length=1)
    line: str = Field(..., max_length=60, min_length=1)
    italicLine: str = Field(..., max_length=60)


class ImageCard(BaseModel):
    id: str = Field(..., max_length=64, min_length=1)
    t0: float = Field(..., ge=0.0, le=600.0)
    t1: float = Field(..., ge=0.0, le=600.0)
    anchorWordIndex: int | None = Field(None, ge=0, le=9007199254740991)
    type: Literal["imageCard"]
    imageId: str = Field(..., max_length=64, min_length=1)
    label: str | None = Field("", max_length=40)
    x: float = Field(..., ge=-4000.0, le=4000.0)
    y: float = Field(..., ge=-4000.0, le=4000.0)
    w: float = Field(..., ge=100.0, le=4000.0)
    h: float = Field(..., ge=100.0, le=4000.0)
    tilt: float | None = Field(0, ge=-20.0, le=20.0)
    objectPosition: str | None = Field("50% 50%", max_length=20)


class ImageCardSpec(BaseModel):
    imageId: str = Field(..., max_length=64, min_length=1)
    label: str | None = Field("", max_length=40)
    x: float = Field(..., ge=-4000.0, le=4000.0)
    y: float = Field(..., ge=-4000.0, le=4000.0)
    w: float = Field(..., ge=100.0, le=4000.0)
    h: float = Field(..., ge=100.0, le=4000.0)
    tilt: float | None = Field(0, ge=-20.0, le=20.0)
    objectPosition: str | None = Field("50% 50%", max_length=20)


class PatternId(StrEnum):
    jaali = "jaali"
    arches = "arches"
    bandhani = "bandhani"
    leheriya = "leheriya"
    solid = "solid"
    blocks = "blocks"


class ImageId(RootModel[str]):
    root: str = Field(..., max_length=64, min_length=1)


class ObjectPosition(RootModel[str]):
    root: str = Field(..., max_length=20)


class FocusRing(BaseModel):
    cx: float = Field(..., ge=-4000.0, le=4000.0)
    cy: float = Field(..., ge=-4000.0, le=4000.0)
    r: float = Field(..., ge=10.0, le=4000.0)
    at: float = Field(..., ge=0.0)
    dur: float = Field(..., ge=0.1)


class FilmStrip(BaseModel):
    id: str = Field(..., max_length=64, min_length=1)
    t0: float = Field(..., ge=0.0, le=600.0)
    t1: float = Field(..., ge=0.0, le=600.0)
    anchorWordIndex: int | None = Field(None, ge=0, le=9007199254740991)
    type: Literal["filmStrip"]
    imageIds: list[ImageId] = Field(..., max_length=3, min_length=1)
    objectPositions: list[ObjectPosition] | None = None
    kicker: str = Field(..., max_length=40)
    title: str = Field(..., max_length=40, min_length=1)
    focusRing: FocusRing | None = None
    travel: float | None = Field(
        160, description="how far the strip slides left over its life", ge=-4000.0, le=4000.0
    )


class PatternCard(BaseModel):
    id: str = Field(..., max_length=64, min_length=1)
    t0: float = Field(..., ge=0.0, le=600.0)
    t1: float = Field(..., ge=0.0, le=600.0)
    anchorWordIndex: int | None = Field(None, ge=0, le=9007199254740991)
    type: Literal["patternCard"]
    pattern: PatternId
    label: str = Field(..., max_length=40)
    x: float = Field(..., ge=-4000.0, le=4000.0)
    y: float = Field(..., ge=-4000.0, le=4000.0)
    w: float = Field(..., ge=100.0, le=4000.0)
    h: float = Field(..., ge=100.0, le=4000.0)
    tilt: float | None = Field(0, ge=-20.0, le=20.0)


class Equation(BaseModel):
    id: str = Field(..., max_length=64, min_length=1)
    t0: float = Field(..., ge=0.0, le=600.0)
    t1: float = Field(..., ge=0.0, le=600.0)
    anchorWordIndex: int | None = Field(None, ge=0, le=9007199254740991)
    type: Literal["equation"]
    left: str = Field(..., max_length=30, min_length=1)
    right: str = Field(..., max_length=30, min_length=1)
    top: float | None = Field(230, ge=-4000.0, le=4000.0)
    leftSize: int | None = Field(150, ge=40, le=320)
    rightSize: int | None = Field(130, ge=40, le=320)
    leftColor: ColorToken | None = None
    rightColor: ColorToken | None = None


class Burst(BaseModel):
    seed: int | None = Field(7, ge=-9007199254740991, le=9007199254740991)
    count: int | None = Field(46, ge=0, le=200)
    cx: float | None = Field(540, ge=-4000.0, le=4000.0)
    cy: float | None = Field(330, ge=-4000.0, le=4000.0)


class Reveal(BaseModel):
    id: str = Field(..., max_length=64, min_length=1)
    t0: float = Field(..., ge=0.0, le=600.0)
    t1: float = Field(..., ge=0.0, le=600.0)
    anchorWordIndex: int | None = Field(None, ge=0, le=9007199254740991)
    type: Literal["reveal"]
    word: str = Field(..., max_length=24, min_length=1)
    devanagari: str | None = Field(None, max_length=24)
    definition: str | None = Field(None, max_length=60)
    top: float | None = Field(170, ge=-4000.0, le=4000.0)
    burst: Burst | None = Field(
        {"seed": 7, "count": 46, "cx": 540, "cy": 330}, validate_default=True
    )


class StrikeLine(BaseModel):
    id: str = Field(..., max_length=64, min_length=1)
    t0: float = Field(..., ge=0.0, le=600.0)
    t1: float = Field(..., ge=0.0, le=600.0)
    anchorWordIndex: int | None = Field(None, ge=0, le=9007199254740991)
    type: Literal["strikeLine"]
    text: str = Field(..., max_length=40, min_length=1)
    top: float | None = Field(520, ge=-4000.0, le=4000.0)
    size: int | None = Field(72, ge=30, le=200)
    strikeAt: float | None = Field(1.3, description="seconds after t0 the strike starts", ge=0.0)
    strikeDur: float | None = Field(0.5, ge=0.1)
    strikeWidth: float | None = Field(640, ge=50.0, le=4000.0)
    color: ColorToken | None = None


class Item(BaseModel):
    text: str = Field(..., max_length=24, min_length=1)
    at: float = Field(..., description="seconds after t0 this chip pops", ge=0.0)
    bg: ColorToken | None = "mar"
    color: ColorToken | None = "iv"


class Chips(BaseModel):
    id: str = Field(..., max_length=64, min_length=1)
    t0: float = Field(..., ge=0.0, le=600.0)
    t1: float = Field(..., ge=0.0, le=600.0)
    anchorWordIndex: int | None = Field(None, ge=0, le=9007199254740991)
    type: Literal["chips"]
    items: list[Item] = Field(..., max_length=6, min_length=1)
    x: float | None = Field(60, ge=-4000.0, le=4000.0)
    y: float | None = Field(230, ge=-4000.0, le=4000.0)
    size: int | None = Field(76, ge=30, le=160)


class SfxType(StrEnum):
    whoosh = "whoosh"
    pop = "pop"
    tick = "tick"
    glitch = "glitch"
    impact = "impact"
    riser = "riser"
    sub = "sub"


class EndCard(BaseModel):
    brand: str = Field(..., max_length=40, min_length=1)
    line1: str = Field(..., max_length=60, min_length=1)
    line2: str | None = Field(None, max_length=60)
    handle: str | None = Field(None, max_length=40)
    bgImageId: str | None = Field(None, max_length=64, min_length=1)
    t0: float | None = Field(
        None,
        description="defaults to the last 'arch' mode switch, else duration − 2.5",
        ge=0.0,
        le=600.0,
    )


class TranscriptWord(BaseModel):
    w: str
    t: float = Field(..., ge=0.0, le=600.0)
    end: float | None = Field(None, ge=0.0, le=600.0)
    conf: float | None = Field(None, ge=0.0, le=1.0)


class StyleTokens(BaseModel):
    id: str = Field(..., min_length=1)
    name: str = Field(..., min_length=1)
    tagline: str
    palette: Palette
    fonts: Fonts
    grain: float = Field(..., ge=0.0, le=1.0)
    pace: float = Field(..., ge=0.0, le=1.0)
    captionStyle: CaptionStyle
    captionAccent: CaptionAccent | None = "gold"
    captionSize: int = Field(..., ge=40, le=140)
    endCardShape: EndCardShape
    pattern: Pattern
    preferredElements: list[str]
    motion: Motion | None = Field({}, validate_default=True)


class Prop(BaseModel):
    label: str = Field(..., max_length=40)
    point: Point


class Subject(BaseModel):
    faceBox: Rect
    freeZone: Rect = Field(..., description="where poster type may go — the wall above the head")
    prop: Prop | None = None


class VideoMode(BaseModel):
    t: float = Field(..., ge=0.0, le=600.0)
    mode: VideoModeName
    zoomPoint: Point | None = Field(
        None, description="zoom only — the stage point (px) the punch-in centres on"
    )
    zoomScale: float | None = Field(None, ge=1.2, le=3.5)


class TextLine(BaseModel):
    text: str = Field(..., max_length=80, min_length=1)
    font: TextFont
    size: int = Field(..., ge=20, le=320)
    color: ColorToken | None = Field(
        None, description="omitted → auto by context (light wall vs dark stage)"
    )
    tracking: float | None = Field(None, description="letter-spacing in em", ge=0.0, le=1.0)
    lineHeight: float | None = Field(None, ge=0.8, le=2.0)


class SplitCards(BaseModel):
    id: str = Field(..., max_length=64, min_length=1)
    t0: float = Field(..., ge=0.0, le=600.0)
    t1: float = Field(..., ge=0.0, le=600.0)
    anchorWordIndex: int | None = Field(None, ge=0, le=9007199254740991)
    type: Literal["splitCards"]
    cards: tuple[ImageCardSpec, ImageCardSpec]
    stagger: float | None = Field(0.15, ge=0.0, le=1.0)


class BleedPlate(BaseModel):
    id: str = Field(..., max_length=64, min_length=1)
    t0: float = Field(..., ge=0.0, le=600.0)
    t1: float = Field(..., ge=0.0, le=600.0)
    anchorWordIndex: int | None = Field(None, ge=0, le=9007199254740991)
    type: Literal["bleedPlate"]
    imageId: str | None = Field(None, max_length=64, min_length=1)
    patternId: PatternId | None = None
    kicker: str = Field(..., max_length=40)
    title: str = Field(..., max_length=40, min_length=1)
    objectPosition: str | None = Field("50% 50%", max_length=20)
    labelTop: float | None = Field(210, ge=-4000.0, le=4000.0)


class SfxCue(BaseModel):
    t: float = Field(..., ge=0.0, le=600.0)
    type: SfxType
    dur: float | None = Field(None, ge=0.05, le=5.0)
    gain: float | None = Field(0.8, ge=0.0, le=1.5)
    repeat: int | None = Field(None, ge=1, le=40)
    every: float | None = Field(None, ge=0.03, le=2.0)


class Transcript(BaseModel):
    language: str = Field(..., min_length=2)
    words: list[TranscriptWord]


class Sfx(BaseModel):
    auto: bool | None = True
    intensity: float | None = Field(0.8, ge=0.0, le=1.0)
    extra: list[SfxCue] | None = None


class PosterText(BaseModel):
    id: str = Field(..., max_length=64, min_length=1)
    t0: float = Field(..., ge=0.0, le=600.0)
    t1: float = Field(..., ge=0.0, le=600.0)
    anchorWordIndex: int | None = Field(None, ge=0, le=9007199254740991)
    type: Literal["posterText"]
    lines: list[TextLine] = Field(..., max_length=4, min_length=1)
    top: float = Field(..., ge=-4000.0, le=4000.0)
    anim: Anim | None = "rise"
    left: float | None = Field(None, ge=-4000.0, le=4000.0)
    w: float | None = Field(None, ge=100.0, le=4000.0)
    align: Align | None = None
    accent: Accent | None = Field(None, description="sfx hint for this line")


class Plan(BaseModel):
    version: Literal[1]
    meta: PlanMeta
    style: StyleTokens
    subject: Subject
    videoModes: list[VideoMode] = Field(..., min_length=1)
    captions: Captions
    elements: list[
        PosterText
        | PlanElement1
        | Counter
        | LockCard
        | PropPunchIn
        | FeedPhone
        | Stamp
        | ChapterCard
        | ImageCard
        | SplitCards
        | BleedPlate
        | FilmStrip
        | PatternCard
        | Equation
        | Reveal
        | StrikeLine
        | Chips
    ]
    sfx: Sfx
    endCard: EndCard | None = None


class RasikaPlanBundle(BaseModel):
    """
    Rasika Plan v1 (edit description), word-level Transcript and SFX cue. Generated — do not edit.
    """

    plan: Plan
    transcript: Transcript
    sfxCue: SfxCue
