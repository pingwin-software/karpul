# The screen: design system, motion, theme, layout

Moved out of CLAUDE.md, which keeps a one-line pointer here. These are the
feature notes for working on this part of Karpul: the rules, where they live
and why. Keep them in step with the code like CLAUDE.md itself.

**The idea.** One question per screen. A row says four things (when, the way, who drives, how it
stands for you) and everything else about a ride is one tap in. The look follows Apple's
conventions (large titles, inset grouped lists, capsule controls, sheets, one floating tab bar) in
Karpul's own green; Karpul keeps its name, mark and colour. The owner asked for exactly this: a
system that reads as Apple's, far less on screen at once, and icons from a proper set.

**Styling.** The frontend is Tailwind v4 (via `@tailwindcss/vite`) plus a hand-written design
system in `src/index.css` (one stylesheet in parts: it `@import`s `src/styles/*.css`: tokens,
controls, layout, grouped, board, plan, admin-log, ride, people, sheets, feedback, fleet, extras,
themes, Tailwind inlining them at build; the media blocks, phones, wide screens, dark and hover,
are in the last two and must stay last). The tokens (`styles/tokens.css`, the dark ones in
`themes.css`):

- **Colour.** iOS's grouped greys: the ground `--bg` (#f2f2f7, black in the dark), a cell
  `--surface` (white, #1c1c1e), the labels `--text` and `--muted`, hairlines `--border`. One tint,
  Karpul's green (`--green`), for "selected / go"; red (`--red`, Apple's accessible one, so it
  carries small text) only for removal. `--fill` / `--fill-strong` are the grey wash that fills a
  control (a field, a switch's track, a quiet button) on a cell and on the ground alike.
- **No elevation at rest.** A cell is a white shape on the grey ground: no stroke and no shadow
  (`--shadow` and `--shadow-card` are `none`). Only what floats over the page casts
  (`--shadow-pop`: a popover, a sheet, the tab bar), and a card under a mouse (`--shadow-hover`).
- **Shapes.** Cells 22px (`--radius`), controls 12px (`--radius-sm`), sheets and dialogs 30px
  (`--radius-lg`); buttons, chips, tags, the segmented control and the stepper are capsules
  (`--radius-pill`).
- **Type.** The system font where it is San Francisco (`-apple-system`: Apple's devices; Apple
  does not license it for shipping anywhere else), the bundled Inter (`@fontsource/inter`, in
  `main.tsx`, because the app ships as one self-hosted container) on every other system. The root
  is 16px with a slight negative tracking; a title is 700 and tighter.
- **Controls** (`styles/controls.css`). A field is filled (`--fill`), with no stroke until it has
  the focus (a tint edge and a soft ring); the custom pickers and the route box follow it. The
  switch is iOS's: a capsule track that turns green (`--switch-on`) under a white knob. The
  segmented control (`SegThumb`, `components/Segmented.tsx`) is a grey capsule with the picked
  choice on a white thumb, one element that slides. Buttons come in three levels and a screen has
  one filled one: `.btn-primary` (the tint, white ink), `.btn` (a grey capsule in the tint's ink),
  `.link` (plain tint text); `.soft-action` is a tinted capsule for the few things a card invites
  you to do. A press darkens and gives a little (`scale(0.98)`).
- **Grouped lists** (`styles/grouped.css`). `.group` is iOS's inset grouped list: a white cell
  with `.group-row`s in it and a hairline between them that starts where the row's text does
  (`--group-inset`). A row is a button with a leading mark or time, its text (`.group-text`: a
  title over a quiet line) and what trails (a state, a count, `.group-chevron`). `.tile` is a
  row's mark on a coloured tile, as iOS's settings draw them. The rides ahead, the *You* tab, the
  *New ride* sheet and a ride's people all sit in these.

The semantic class names (`.card`, `.group`, `.pax-row`, `.panel`, `.btn`, …) are the contract the
components render against. On a phone the layout is one 600px column. From 1024px
(`lib/useWide.ts`, the *Wide screens* block in `themes.css`) it is a desktop app that fills the
window: the page never scrolls; the menu is docked down the left edge (`Dock` in `Sidebar.tsx`),
and each view is two full-height panes (`.split`) that scroll on their own (`data-scroll-pane`).
Two media blocks carry the phone layout: `max-width: 600px` (sheets become true bottom sheets) and
`pointer: coarse` (44px targets, hover choreography switched off). `lib/useCoarsePointer.ts`
exposes the same query to components that need to change their wording.

**Icons.** Glyphs from Ionicons (MIT), the open set drawn to sit beside iOS; Apple's own SF
Symbols may not be used outside Apple's platforms. The app does not load the package at run time:
`scripts/gen-icons.mjs` (from `frontend/`, needs the `ionicons` dev dependency) writes
`src/components/ionicons.gen.ts` with the inner SVG of only the glyphs named in it, and
`components/icons.tsx` maps the names the components use (`PlusIcon`, `PhoneIcon`, …, the
contract) to glyphs through `icon('name')` and draws them in `currentColor` (`Glyph`). To use
another glyph: add its name to the script, run it, map it. An outline glyph's line is a class
(`.ion-line`) driven by `--ion-line`, so a small icon gets a heavier line and `weight="bold"`
still means something. `components/NavIcon.tsx` pairs each navigation mark's outline glyph with
its filled twin (`regular` for the dock, `filled` for the tab bar and the tiles). **Icons
navigate, words act**: icons are for the tab bar, the corners of a screen and the rows of a list;
a button says what it does in words.

**The mark.** The app's own mark (the dock's head, the sign-in card, the favicon and the
installed-app icons) is a car, side-on, whose back half turns into a thunderbolt: one thick white
line on a tile that runs from mint to forest green. `public/favicon.svg` is the source, split by
`<!-- tile -->` / `<!-- mark -->` comments that `scripts/render-icons.mjs` uses to derive the PNGs
(`pwa-192`/`pwa-512` with rounded transparent corners, `pwa-maskable-512` full-bleed with the mark
scaled into the platform's safe zone, `apple-touch-icon` full-bleed and opaque), and
`components/Logo.tsx` repeats the same drawing inline (its gradient ids per instance, through
`useId`). Change the mark in all three places.

**Cars.** A car the board knows gets a picture instead of the generic icon: a flat side view,
facing left, all models to one scale. `lib/carShapes.ts` holds each model as numbers (length,
height, wheelbase, a dozen points of its roofline, in millimetres) and `carShape()` turns them
into paths; `components/CarArt.tsx` draws them (`CarArt`, and `CarGlyph`, which falls back to the
make's logo and then to `CarIcon`): one paint, a darker band along the sill, slate glass, plain
wheels, no gradients, so a car sits in a row the way an icon does, in light and dark alike. The
drawings are generated, not traced, so they carry no licence; the dimensions are approximate.
`lib/carModels.ts` decides which model a car name is (`carModel`: "Mazda 6e (BG-123-XY)", "grey
Octavia"; seventeen models, the longer number first so 3008 is not read as 308) and what colour it
speaks of (`carPaint`: colour words in English and Serbian, any ending, from one small palette;
with none, the model's own paint). **A new car** is an entry in `SPECS` and a pattern in `MODELS`;
`carShapes.test.ts` checks every drawing stays inside its box. `carPowertrain()` in the same file
says whether a name is *electric*, a *hybrid*, *diesel* or *petrol* (explicit words and engine
badges first, hybrid before electric before diesel before petrol so "plug-in hybrid electric" is a
hybrid; then models sold only one way) and `PowertrainMark` draws it as a 12px glyph *after the
car's name* (`.pt-mark`), deliberately not on the picture. The driver card spells it out as
"Electric" / "Hybrid" / "Diesel" / "Petrol" beside *Shared car* / *Own car* under the car's name.
Below that, `carBrand()` recognises a *make* from the name (make words and the models people write
instead of one; words that are also plain English, like "Seat" or "Focus", must be capitalised to
count) and `BrandLogo` / `CarGlyph` show its mark from the `simple-icons` package in
`currentColor`. Only the brands listed in `LOGOS` are bundled (named imports tree-shake);
Mercedes, Land Rover, Jaguar, Alfa Romeo and Lexus are not in that package, so they keep the
generic icon. Avatars (`components/Avatar.tsx`) derive a stable pastel from the name.

**Motion.** Things go back the way they came: a view slides in 40px from its side after the one it
replaces has slid out the other way (`components/SlideSwitch.tsx`: the keyed content's wrapper
hands its DOM to the host as it unmounts, and a `cloneNode` snapshot laid over the host plays
`.swap-leave-*` while the real content is long gone, so nothing in it runs or fetches again; the
entering `.swap-*` is marked `data-after` and holds, invisible, for the snapshot's `--swap-out`
(100ms) before its own step, so the two are never on screen together), a flyout comes 10px out of
its anchor, a dialog grows a little out of the middle as it fades in, a toast rises 16px, on
curves that decelerate in and accelerate out (`--ease-out`, `--ease-in`; the one overshoot is
`--ease-bounce`, on the update screen's bolt and the tab bar's glide) and short durations
(`--dur-fast` 150ms, `--dur-normal` 200ms, `--dur-gentle` 250ms, hover 100ms). The keyframes are
in the *Motion* and *Sheets & dialogs* sections of the stylesheets, the two hooks in
`lib/motion.ts`. `useSlideDir(value, rank)` says which side freshly keyed content enters from (a
higher rank enters from the right, a lower one from the left, NaN means no slide) and `App.tsx`
wraps the view (Rides sits left of Cars, Cars left of You) in `SlideSwitch`.
`useClosing(onClose)` lets `Sheet`, `RidePage` and `ConfirmDialog` play their exit before the
parent unmounts them: every close from inside the overlay goes through `requestClose`, which adds
`backdrop-closing`, and `onClose` runs on the panel's `animationend` (with a fallback timeout); a
parent that unmounts the overlay itself, after a save, still closes on the spot. Sheets rise from
the bottom edge on a phone and pop up on a desktop, confirmations grow out of the middle and
popovers come out of their anchor (`Popover` sets `transform-origin` and measures itself with
`offsetWidth`, which a transform does not change), the toast and *New ride* spring in (*New ride*
also contracts while pressed and springs back on release; the pressed state comes from pointer and
key events, not `:active`, which phones apply late and Chrome holds on after the finger lifts), a
ride opened on a phone comes in from the right as a screen of its own and goes back the same way
(`.ride-page`, below), a passenger who just got in grows into the car's list as a grid row from
`0fr` (`.pax-slot-new`, `useArrivals` in `lib/motion.ts`: not on first render, not your own row),
and the tab bar's grey pill and the segmented control's thumb move one marker element instead of
recolouring buttons. Reduced motion collapses every duration, so the exits still fire
`animationend`.

**Theme.** Light, dark or the system's choice: `lib/theme.ts` is an external store like the
locale, remembered as `karpul.theme`, and puts the choice on the root as `data-theme` and what is
on screen as `data-resolved` (and the browser chrome's colour, `LIGHT_BAR` / `DARK_BAR`, the
ground's own). The dark tokens live under both `:root[data-theme='dark']` and the
`prefers-color-scheme` media query (so a dark phone never paints light before the script runs);
the rules that were never tokens (the pastel avatars, the toast, the error text, the dark ink on
the bright dark-theme green) key off `data-resolved`. The switch (`ThemeSwitch`) sits above the
language switch under *Settings*.

**Screen structure: three places.** The views are `View` in `lib/selection.ts`, remembered in
`localStorage` (`karpul.view`):

- **Rides** (`upcoming`, the default). `Upcoming` (`components/Upcoming.tsx`): every ride from
  today for the next `UPCOMING_DAYS` (90; the API caps a range at 92). On top, **your next ride**
  as a card in the tint (`components/NextRide.tsx`, picked by `nextRide()` in `lib/nextRide.ts`:
  the first ride you drive or sit in that is not over; today's counts until it is back): when,
  the way, one line on who drives and where you get in, and on the day, from half an hour before
  it leaves, a passenger's one button, *I'm at the pickup point*. Under it a search field and one
  filter button (a menu: *All*, *Free seats*, *My rides*, *I'm in*; state local to `Upcoming`),
  then a sticky heading per day and a `.group` under it, one row per ride: the time, the way over
  who drives, and one trailing word (*Driving*, *You're in*, *Full*, or the free seats). What
  needs someone (a driver, an approval, an answer) is a single amber line under the driver. The
  return time, the car and the stops are on the ride's own screen. A row's `aria-label` still
  reads the driver and the car, which is what the end-to-end tests match.
- **Cars** (`day`). The shared cars' day as a timetable (below).
- **You** (`you`, a phone's third tab). `YouPage` in `components/Sidebar.tsx`: your account on
  top, then grouped lists of everything that is not about one ride: *Your rides* (`MyRides`),
  *Shared cars* (`SharedCars`: how they stand, managed on the same cards by admins, who also get
  the *Usage* tab), the *Shared car guide* (`CarGuide`), *Manage* for admins (approvals, the
  garage list, people, places, every ride, the log), *Settings* (*Notifications*, *Install the
  app* while the browser can, the theme and the language) and *Help* (*How to use Karpul*,
  *What's new*, *Take the tour*, *Contact support*, *Report a bug or send feedback*). It used to
  be a drawer behind a ☰, where half of it went unfound. On a wide screen the same menu is the
  `Dock`, with the two views (*Rides*, *Cars*) as a radio group on top; `View` `you` then shows
  the list (`page` in `App.tsx`). Something waiting for an admin is a dot on the *You* tab and a
  count on its item.

The phone's tab bar (`.tabbar` in `App.tsx`, a radio group named *View*) is a capsule floating
over the board on a blurred material, the one translucent surface in the app; the picked tab is in
the tint on a grey pill (`.tab-glider`) that glides to it. **New ride** (`NewRideFab`, a green
capsule with its name on it) floats beside it in `.bottom-bar`; a wide screen has `NewRideButton`
at the head of the list. Either opens `NewRideSheet` (`components/AddRideButton.tsx`), which asks
the one question that matters first, who drives: *Shared car*, *My car* or *I need a seat*. People
who meant to book a shared car used to ask for a seat instead; three plainly worded rows end that.
The answer opens `RideForm` on that kind (`kind`), or the request form. It is deliberately the
only add control. The title at the top of a phone is a large title that scrolls away with the page
(`.topbar-title`); the live lamp sits beside it.

*Cars* is the day plan (`components/DayPlan.tsx`, the arithmetic in `lib/dayPlan.ts`, tested in `dayPlan.test.ts`) is
one day for scheduling the company cars, drawn as one *road* per car: every active pool car (free
ones too) and then each own car going, hours across: the whole day, 00:00 to 24:00 (`DAY_AXIS`), at a
fixed width per hour (`--plan-hour`), so the board scrolls sideways (`.plan-scroll`, the car's name
sticky on the left) and opens on now today, else an hour before the first ride, else 07:00. A ride is a
stretch of its road in the driver's colour (`avatarTone` in `lib/tone.ts`, the avatar's pastel and ink
as `.tone-*`; solid green when it is yours), from the driver's avatar at departure to a dot at the
return, the way `CarDetail` draws a route; no return runs off the right edge, as the server holds the
car to end of day. Now is an ink rule behind the roads (not red, which is for removal); each pool car
says when it is next free (`rowStatus`). Each pool car's row is headed by its picture (`CarGlyph`), its name (a button: how the car stands, `SharedCars`), when it is next free and *Book* (the ride form on that car, `onBookCar`; left out on a past day). Switching to it jumps to today; `range` is that one day. A tapped bar
opens the ride (on its own screen on a phone, beside the plan on a wide screen, `.split-day`); a free stretch of a pool car
(`.plan-free`, never in the past; under a mouse a ring follows the pointer to the half hour, popping in on a spring and shrinking away where it was when the pointer leaves, per road in `pins`, and the clock's ring the same through `useLinger` in `lib/motion.ts`; a company car's hour ticks are elements, `.plan-tick`, and the ones on a free stretch are green-tinted and stand up in a wave from the pointer, `--d` delaying each by its distance) opens `RideForm` with `slot`: that car, departure at the tapped
half hour, back by the next booking or 17:00. While the board scrolls (a phone, a narrow pane), an
overview strip sits on top of it (`components/PlanOverview.tsx`): the whole day across the card's width,
one thin lane per car with its rides in the drivers' tones, and a green frame over the hours on screen;
a tap centres the board there and a drag pans it (`visibleSpan` / `scrollToCentre` in `lib/dayPlan.ts`),
and it is a keyboard slider too. It hides itself when the day fits. A picked ride that you run (`runs()`, so any ride for an
admin) grows a pencil at its end (`.plan-edit`), and a double click on it opens the edit form too. The same
day can be drawn as a **clock** instead (`components/DayClock.tsx`, geometry in `lib/dayClock.ts`, tested in
`dayClock.test.ts`): a 24-hour dial, midnight at the top, one ring per car (pool cars outermost, then own cars),
rides as arcs in the driver's tone from their initials to a dot, the hours gone today as a faint wedge and now as
a hand. A free arc of a pool car books like `.plan-free` (pin at the half hour under the pointer), the middle of
the dial reads out the hovered slot, the hovered or picked ride (with *Edit* when you run it) or the time, and a
legend beside it names the rings with each car's status. The Clock / Timeline switch sits in the plan's head,
remembered as `karpul.planShape`; with nothing remembered every screen opens on the timeline, because the timetable
is what people book from. **A ride.** On a phone a picked ride is a screen of its own in every view: `RidePage`
(`components/RidePage.tsx`), a fixed full-screen layer over the board (z-index 9: above the tab
bar, under every sheet's backdrop, so the card's own sheets and App's forms stack over it) with a
back chevron, and `CarDetail` in a body that scrolls on its own. It is open while `carSel` names a
loaded ride (`pageRide` in `App.tsx`, so a reload, a shared `/ride/{id}` link and a just-added
ride open it too), closes through `useClosing` and `useBackClose` (the phone's back), and the list
stays mounted underneath, so it comes back where it was scrolled. A wide screen keeps the pane
beside the list. `CarDetail` reads top to bottom as the decision does: the head (`.ride-head`: the
day, the time large beside the car's picture, the way, when it returns, and a chip for your place
in it; *Edit* for whoever runs it and the ⋯ menu, which also holds *Suggest another time*,
*Share ride*, *Add to calendar*), then what the ride waits on (`.ride-asks`: a change, an
approval, a driver, the mail to the office, *Running late?*), then **the people** (one `.group`:
the driver with a call button, the passengers, and a dashed ring for the free seats), then the
route and its map, the car, the facts, the odometer and the thread. **The one thing your place in
the ride lets you do now is pinned to the foot** (`.ride-bar`, sticky in the scrolling pane):
*Get in this car* / *Switch to this car*, else *Wait for a seat*, else on the day *I'm at the
pickup point*. It asks where you get in after the tap (`PickupSheet`). *Leave* stays on your own
row.

Every dialog is a `Sheet` (bottom sheet on a phone,
centred panel on a desktop), the one exception being `UpdateScreen`, which takes the whole screen
because the bolt you trace on it is the screen; destructive actions go through `ConfirmDialog` instead of
`window.confirm`. Every overlay (`Sheet`, `RidePage`, `ConfirmDialog`, `Popover`) calls
`useBackClose` (`lib/useBackClose.ts`), so a phone's back button closes the topmost one instead
of leaving the page: the first overlay to open pushes one history entry, the ones stacked on top
join an in-memory stack, back pops the top and re-pushes while any remain, and a close by any
other route pops the entry when it was the last, so back never lands on a dead entry. **No native pickers or dropdowns**: `Select`, `DatePicker` and `TimePicker` are
custom controls (and `Menu` is the ⋯ menu) built on `Popover`, which portals to `<body>` and
positions itself against its anchor with `position: fixed`, so it is never clipped by a sheet's
scrolling body and flips above the anchor when the viewport runs out. `TimePicker` shows hour (00–23)
and minute columns and emits `HH:MM`. `App.tsx` resolves which row is open (`upcomingSelection`): only an explicit tap opens one on a
phone; a wide pane is never empty, so with nothing picked it shows your next ride, else the first.
**Wording:** the thing you add, edit, duplicate or remove is a *ride*; *car* is reserved for the
vehicle (the pool, "Shared car" / "Own car", "get in this car", "in this car"). The pool cars are
*shared cars* on screen (Serbian *zajednički auto*); the code and the API keep saying *corporate*
(`CarType.corporate`, `/api/cars/corporate`), and the charging card stays the *company card*.
