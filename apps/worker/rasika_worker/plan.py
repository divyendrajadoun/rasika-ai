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


class PlanElement2(BaseModel):
    id: str = Field(..., max_length=64, min_length=1)
    t0: float = Field(..., ge=0.0, le=600.0)
    t1: float = Field(..., ge=0.0, le=600.0)
    anchorWordIndex: int | None = Field(None, ge=0, le=9007199254740991)
    type: Literal["browserCard"]
    imageId: str = Field(..., max_length=64, min_length=1)
    url: str = Field(
        ..., description="shown in the address bar, e.g. linear.app", max_length=80, min_length=1
    )
    x: float | None = Field(60, ge=-4000.0, le=4000.0)
    y: float | None = Field(420, ge=-4000.0, le=4000.0)
    w: float | None = Field(960, ge=300.0, le=1080.0)
    h: float | None = Field(720, ge=240.0, le=1700.0)
    scroll: float | None = Field(0.35, ge=0.0, le=1.0)
    tilt: float | None = Field(0, ge=-12.0, le=12.0)


class Glass(StrEnum):
    rocks = "rocks"
    highball = "highball"
    coupe = "coupe"
    martini = "martini"
    wine = "wine"
    mug = "mug"


class Layer(BaseModel):
    name: str = Field(..., max_length=28, min_length=1)
    amount: str = Field(
        ...,
        description='the measure as written, e.g. "45 ml", "2 dashes"',
        max_length=16,
        min_length=1,
    )
    color: str = Field(
        ...,
        description="a real colour (#rrggbb), for things that have one: a liquid, a fighter's corner",
        pattern="^#[0-9a-fA-F]{6}$",
    )
    fill: float = Field(..., ge=0.01, le=1.0)
    at: float = Field(..., description="seconds after t0 the pour starts", ge=0.0)
    dur: float | None = Field(1.2, ge=0.3, le=6.0)


class Kind(StrEnum):
    citrus = "citrus"
    cherry = "cherry"
    leaf = "leaf"
    olive = "olive"
    peel = "peel"


class Garnish(BaseModel):
    name: str = Field(..., max_length=24, min_length=1)
    kind: Kind
    at: float = Field(..., ge=0.0)


class PlanElement3(BaseModel):
    id: str = Field(..., max_length=64, min_length=1)
    t0: float = Field(..., ge=0.0, le=600.0)
    t1: float = Field(..., ge=0.0, le=600.0)
    anchorWordIndex: int | None = Field(None, ge=0, le=9007199254740991)
    type: Literal["pourGlass"]
    glass: Glass | None = "rocks"
    cx: float | None = Field(540, ge=-4000.0, le=4000.0)
    top: float | None = Field(520, ge=-4000.0, le=4000.0)
    size: int | None = Field(760, description="height of the glass in px", ge=300, le=1100)
    ice: bool | None = False
    layers: list[Layer] = Field(..., max_length=8, min_length=1)
    garnish: Garnish | None = None


class A(BaseModel):
    name: str = Field(..., max_length=20, min_length=1)
    color: str | None = Field(
        "#e2403a",
        description="a real colour (#rrggbb), for things that have one: a liquid, a fighter's corner",
        pattern="^#[0-9a-fA-F]{6}$",
    )


class B(BaseModel):
    name: str = Field(..., max_length=20, min_length=1)
    color: str | None = Field(
        "#2f6fe0",
        description="a real colour (#rrggbb), for things that have one: a liquid, a fighter's corner",
        pattern="^#[0-9a-fA-F]{6}$",
    )


class By(StrEnum):
    a = "a"
    b = "b"


class Hit(BaseModel):
    at: float = Field(..., ge=0.0)
    by: By
    dmg: float = Field(..., ge=1.0, le=100.0)
    word: str | None = Field("POW!", max_length=14, min_length=1)


class Winner(StrEnum):
    a = "a"
    b = "b"


class PlanElement4(BaseModel):
    id: str = Field(..., max_length=64, min_length=1)
    t0: float = Field(..., ge=0.0, le=600.0)
    t1: float = Field(..., ge=0.0, le=600.0)
    anchorWordIndex: int | None = Field(None, ge=0, le=9007199254740991)
    type: Literal["fightHud"]
    a: A
    b: B
    top: float | None = Field(150, ge=-4000.0, le=4000.0)
    hits: list[Hit] = Field(..., max_length=24, min_length=1)
    koAt: float | None = Field(
        None, description="seconds after t0; the loser's bar is empty by then", ge=0.0
    )
    winner: Winner


class Season(StrEnum):
    spring = "spring"
    summer = "summer"
    autumn = "autumn"
    winter = "winter"


class Shape(StrEnum):
    arch = "arch"
    rect = "rect"


class Note(BaseModel):
    at: float = Field(..., ge=0.0)
    key: int = Field(..., ge=0, le=7)


class Drum(RootModel[float]):
    root: float = Field(..., ge=0.0)


class PlanElement6(BaseModel):
    id: str = Field(..., max_length=64, min_length=1)
    t0: float = Field(..., ge=0.0, le=600.0)
    t1: float = Field(..., ge=0.0, le=600.0)
    anchorWordIndex: int | None = Field(None, ge=0, le=9007199254740991)
    type: Literal["noteMachine"]
    top: float | None = Field(420, ge=-4000.0, le=4000.0)
    dropAt: float = Field(..., ge=0.0)
    notes: list[Note] = Field(..., max_length=40, min_length=1)
    drums: list[Drum] | None = Field([], max_length=40, validate_default=True)


class Tier(BaseModel):
    label: str = Field(..., max_length=3, min_length=1)
    color: str = Field(
        ...,
        description="a real colour (#rrggbb), for things that have one: a liquid, a fighter's corner",
        pattern="^#[0-9a-fA-F]{6}$",
    )


class Item(BaseModel):
    name: str = Field(..., max_length=18, min_length=1)
    tier: int = Field(..., description="index into tiers", ge=0, le=5)
    at: float = Field(..., description="seconds after t0 the item lands", ge=0.0)


class PlanElement7(BaseModel):
    id: str = Field(..., max_length=64, min_length=1)
    t0: float = Field(..., ge=0.0, le=600.0)
    t1: float = Field(..., ge=0.0, le=600.0)
    anchorWordIndex: int | None = Field(None, ge=0, le=9007199254740991)
    type: Literal["tierBoard"]
    title: str = Field(..., max_length=40, min_length=1)
    top: float | None = Field(300, ge=-4000.0, le=4000.0)
    tiers: list[Tier] = Field(..., max_length=6, min_length=2)
    items: list[Item] = Field(..., max_length=18, min_length=1)


class World(StrEnum):
    space = "space"
    earth = "earth"
    city = "city"
    ocean = "ocean"
    cell = "cell"
    lab = "lab"


class Pose(StrEnum):
    idle = "idle"
    point = "point"
    tap = "tap"
    wow = "wow"
    think = "think"


class HostItem(BaseModel):
    at: float = Field(..., description="seconds after t0 the host arrives here", ge=0.0)
    x: float = Field(..., ge=-4000.0, le=4000.0)
    y: float = Field(..., ge=-4000.0, le=4000.0)
    pose: Pose | None = "idle"


class PlanElement8(BaseModel):
    id: str = Field(..., max_length=64, min_length=1)
    t0: float = Field(..., ge=0.0, le=600.0)
    t1: float = Field(..., ge=0.0, le=600.0)
    anchorWordIndex: int | None = Field(None, ge=0, le=9007199254740991)
    type: Literal["explainerWorld"]
    world: World
    host: list[HostItem] | None = Field([], max_length=24, validate_default=True)
    dolly: float | None = Field(
        0.4, description="how far the camera drifts over the film", ge=0.0, le=1.0
    )


class Kind1(StrEnum):
    newspaper = "newspaper"
    document = "document"
    letter = "letter"


class MarkStyle(StrEnum):
    underline = "underline"
    circle = "circle"
    box = "box"


class PlanElement10(BaseModel):
    id: str = Field(..., max_length=64, min_length=1)
    t0: float = Field(..., ge=0.0, le=600.0)
    t1: float = Field(..., ge=0.0, le=600.0)
    anchorWordIndex: int | None = Field(None, ge=0, le=9007199254740991)
    type: Literal["docCard"]
    kind: Kind1 | None = "newspaper"
    masthead: str | None = Field(None, max_length=32)
    headline: str = Field(..., max_length=90, min_length=1)
    body: str | None = Field(None, max_length=260)
    date: str | None = Field(None, max_length=24)
    mark: str | None = Field(
        None, description="a phrase from the headline to strike with the marker", max_length=40
    )
    markStyle: MarkStyle | None = "underline"
    markAt: float | None = Field(0.8, description="seconds after t0", ge=0.0)
    x: float | None = Field(90, ge=-4000.0, le=4000.0)
    y: float | None = Field(520, ge=-4000.0, le=4000.0)
    w: float | None = Field(900, ge=400.0, le=1000.0)
    tilt: float | None = Field(-2, ge=-8.0, le=8.0)


class Box(BaseModel):
    """
    the region of the screenshot that fills the window
    """

    x: float
    y: float
    w: float = Field(..., gt=0.0)
    h: float = Field(..., gt=0.0)


class Cursor(BaseModel):
    """
    where the cursor goes (screenshot px)
    """

    x: float
    y: float


class Step(BaseModel):
    at: float = Field(..., description="seconds after t0 this step's zoom starts", ge=0.0)
    box: Box = Field(..., description="the region of the screenshot that fills the window")
    cursor: Cursor | None = Field(None, description="where the cursor goes (screenshot px)")
    click: bool | None = False


class PlanElement11(BaseModel):
    id: str = Field(..., max_length=64, min_length=1)
    t0: float = Field(..., ge=0.0, le=600.0)
    t1: float = Field(..., ge=0.0, le=600.0)
    anchorWordIndex: int | None = Field(None, ge=0, le=9007199254740991)
    type: Literal["screenFocus"]
    imageId: str = Field(..., max_length=64, min_length=1)
    url: str | None = Field(
        None, description="shown in the address bar; omit for a frameless screen", max_length=80
    )
    x: float | None = Field(40, ge=-4000.0, le=4000.0)
    y: float | None = Field(380, ge=-4000.0, le=4000.0)
    w: float | None = Field(1000, ge=300.0, le=1080.0)
    h: float | None = Field(1180, ge=300.0, le=1700.0)
    steps: list[Step] = Field(..., max_length=12, min_length=1)


class Key(BaseModel):
    at: float = Field(..., ge=0.0)
    x: float = Field(..., ge=-4000.0, le=4000.0)
    y: float = Field(..., ge=-4000.0, le=4000.0)
    w: float = Field(..., ge=8.0, le=1400.0)
    h: float = Field(..., ge=8.0, le=2200.0)
    radius: float | None = Field(24, ge=0.0, le=1000.0)
    fill: str | None = Field(
        "#111111",
        description="a real colour (#rrggbb), for things that have one: a liquid, a fighter's corner",
        pattern="^#[0-9a-fA-F]{6}$",
    )
    imageId: str | None = Field(
        None,
        description="a crop shown inside (the real button, the logo)",
        max_length=64,
        min_length=1,
    )
    text: str | None = Field(None, max_length=40)
    textColor: str | None = Field(
        "#ffffff",
        description="a real colour (#rrggbb), for things that have one: a liquid, a fighter's corner",
        pattern="^#[0-9a-fA-F]{6}$",
    )


class PlanElement12(BaseModel):
    id: str = Field(..., max_length=64, min_length=1)
    t0: float = Field(..., ge=0.0, le=600.0)
    t1: float = Field(..., ge=0.0, le=600.0)
    anchorWordIndex: int | None = Field(None, ge=0, le=9007199254740991)
    type: Literal["throughLine"]
    keys: list[Key] = Field(..., max_length=16, min_length=2)


class PlanElement13(BaseModel):
    id: str = Field(..., max_length=64, min_length=1)
    t0: float = Field(..., ge=0.0, le=600.0)
    t1: float = Field(..., ge=0.0, le=600.0)
    anchorWordIndex: int | None = Field(None, ge=0, le=9007199254740991)
    type: Literal["pageFlyover"]
    imageId: str = Field(..., description="the full-page screenshot", max_length=64, min_length=1)
    heroImageId: str | None = Field(
        None,
        description="the first-screen screenshot (the card the dive lands on)",
        max_length=64,
        min_length=1,
    )
    logoImageId: str | None = Field(None, max_length=64, min_length=1)
    brand: str | None = Field(None, max_length=40)
    line: str = Field(..., description="the closing statement", max_length=60, min_length=1)
    tail: str | None = Field(None, description="the short italic tail", max_length=60)
    floor: str | None = Field(
        "#f2f3f6",
        description="a real colour (#rrggbb), for things that have one: a liquid, a fighter's corner",
        pattern="^#[0-9a-fA-F]{6}$",
    )


class Shape1(StrEnum):
    circle = "circle"
    box = "box"
    pill = "pill"


class Node(BaseModel):
    id: str = Field(..., max_length=24, min_length=1)
    label: str = Field(..., max_length=28, min_length=1)
    x: float = Field(..., description="centre, in a 1000×1400 diagram space", ge=0.0, le=1000.0)
    y: float = Field(..., ge=0.0, le=1400.0)
    shape: Shape1 | None = "box"


class Edge(BaseModel):
    from_: str = Field(..., alias="from")
    to: str
    label: str | None = Field(None, max_length=24)


class Step1(BaseModel):
    at: float = Field(..., ge=0.0)
    focus: str | None = Field(..., description="a node id, or null for the whole diagram")
    example: str | None = Field(None, description="one concrete example, ≤ 7 words", max_length=48)


class PlanElement14(BaseModel):
    id: str = Field(..., max_length=64, min_length=1)
    t0: float = Field(..., ge=0.0, le=600.0)
    t1: float = Field(..., ge=0.0, le=600.0)
    anchorWordIndex: int | None = Field(None, ge=0, le=9007199254740991)
    type: Literal["diagramZoom"]
    nodes: list[Node] = Field(..., max_length=9, min_length=2)
    edges: list[Edge] | None = Field([], max_length=14, validate_default=True)
    steps: list[Step1] = Field(..., max_length=10, min_length=1)
    top: float | None = Field(240, ge=-4000.0, le=4000.0)


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


class Item1(BaseModel):
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
    items: list[Item1] = Field(..., max_length=6, min_length=1)
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
    note = "note"
    pour = "pour"


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


class PlanElement5(BaseModel):
    id: str = Field(..., max_length=64, min_length=1)
    t0: float = Field(..., ge=0.0, le=600.0)
    t1: float = Field(..., ge=0.0, le=600.0)
    anchorWordIndex: int | None = Field(None, ge=0, le=9007199254740991)
    type: Literal["seasonWindow"]
    seasons: list[Season] = Field(..., max_length=4, min_length=1)
    x: float | None = Field(140, ge=-4000.0, le=4000.0)
    y: float | None = Field(360, ge=-4000.0, le=4000.0)
    w: float | None = Field(800, ge=300.0, le=1080.0)
    h: float | None = Field(980, ge=300.0, le=1700.0)
    shape: Shape | None = "arch"
    frame: ColorToken | None = "goldd"
    cup: bool | None = True


class PlanElement9(BaseModel):
    id: str = Field(..., max_length=64, min_length=1)
    t0: float = Field(..., ge=0.0, le=600.0)
    t1: float = Field(..., ge=0.0, le=600.0)
    anchorWordIndex: int | None = Field(None, ge=0, le=9007199254740991)
    type: Literal["crowd"]
    count: int = Field(..., ge=2, le=100)
    highlight: int | None = Field(0, ge=0, le=100)
    at: float | None = Field(1, description="seconds after t0 the highlight lands", ge=0.0)
    per: str | None = Field(
        None, description='what one figure stands for, e.g. "1 in 10 people"', max_length=40
    )
    label: str | None = Field(None, max_length=40)
    top: float | None = Field(620, ge=-4000.0, le=4000.0)
    color: ColorToken | None = "iv"
    hiColor: ColorToken | None = "gold"


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
    pitch: int | None = Field(None, description="semitones above C5, for `note`", ge=-12, le=24)


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
        | PlanElement2
        | PlanElement3
        | PlanElement4
        | PlanElement5
        | PlanElement6
        | PlanElement7
        | PlanElement8
        | PlanElement9
        | PlanElement10
        | PlanElement11
        | PlanElement12
        | PlanElement13
        | PlanElement14
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
