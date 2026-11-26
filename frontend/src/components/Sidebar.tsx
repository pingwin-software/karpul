import { useState, type ReactNode } from 'react'
import { useT } from '../lib/i18n'
import type { View } from '../lib/selection'
import { Avatar } from './Avatar'
import { NavIcon, type NavName } from './NavIcon'
import { ChevronRightIcon, ChevronUpIcon } from './icons'
import { Logo } from './Logo'
import { LanguageSwitch } from './LanguageSwitch'
import { ThemeSwitch } from './ThemeSwitch'

interface Content {
  /** The place on screen, and going to another (a wide screen's dock carries the switch). */
  view: View
  onView: (view: View) => void
  userName: string
  /** The account's username, shown under the name in the identity block. */
  handle: string
  /** An admin also sees the company-car pool and the people (backend: app/admin.py). */
  isAdmin: boolean
  onAccount: () => void
  onPeople: () => void
  /** The places Karpul knows: the offices, the cars' homes, the suggestions. */
  onPlaces: () => void
  onRideLog: () => void
  onAdminLog: () => void
  onApprovals: () => void
  /** Admins: how many shared-car rides wait for approval (a count on the item). */
  approvals: number
  /** Admins: the own cars' plates the Beograd garage still needs (components/GarageList.tsx). */
  onGarage: () => void
  garage: number
  onGuide: () => void
  /** How to use the app (components/HowTo.tsx). */
  onHowTo: () => void
  onSupport: () => void
  onFeedback: () => void
  /** What changed in the app lately (components/WhatsNew.tsx). */
  onWhatsNew: () => void
  /** The first-login tour again (components/Tour.tsx). */
  onTour: () => void
  onMyRides: () => void
  onNotifications: () => void
  /** Present while this browser can install the app (lib/install.ts). */
  onInstall?: () => void
  /** The shared cars (components/SharedCars.tsx): how they stand, for everyone; the pool and its usage for admins. */
  onSharedCars: () => void
}


interface Item {
  label: string
  /** The item's mark, in the regular (outline) style. */
  icon: NavName
  onSelect: () => void
  /** Something waiting on you there: an amber count after the label. */
  count?: number
  /** The first-login tour points here (`data-tour`, lib/tour.ts). */
  tour?: string
}

type GroupKey = 'admin' | 'help' | 'settings'

/** Which groups are folded, remembered per browser; settings start folded. */
const GROUPS_KEY = 'karpul.drawerGroups'
const DEFAULT_OPEN: Record<GroupKey, boolean> = { admin: true, help: true, settings: false }

function loadOpen(): Record<GroupKey, boolean> {
  try {
    const raw = localStorage.getItem(GROUPS_KEY)
    if (raw) return { ...DEFAULT_OPEN, ...(JSON.parse(raw) as Partial<Record<GroupKey, boolean>>) }
  } catch {
    // Private mode or a broken value: the defaults will do.
  }
  return DEFAULT_OPEN
}

/**
 * What the menu holds, on the *You* tab and in the dock alike: who you are, the
 * things opened most (your rides, the shared cars, their guide) with no heading
 * over them, then *Manage* for admins, *Help*, and *Settings*. In the dock the
 * groups fold and the settings sit in a card at the foot; `flat` (the *You*
 * tab) lays everything out as iOS's grouped lists, each row with its chevron.
 */
function SidebarBody({ userName, handle, isAdmin, onAccount, onPeople, onPlaces, onRideLog, onAdminLog, onApprovals, approvals, onGarage, garage, onGuide, onHowTo, onSupport, onFeedback, onWhatsNew, onTour, onMyRides, onNotifications, onInstall, onSharedCars, flat = false }: Omit<Content, 'view' | 'onView'> & { flat?: boolean }) {
  const pick = (fn: () => void) => fn
  const t = useT()
  const [open, setOpen] = useState(loadOpen)
  const toggle = (key: GroupKey) =>
    setOpen((prev) => {
      const next = { ...prev, [key]: !prev[key] }
      try {
        localStorage.setItem(GROUPS_KEY, JSON.stringify(next))
      } catch {
        // Not remembered, still toggled.
      }
      return next
    })

  // Every day: what you would open most, straight under your name.
  const daily: Item[] = [
    {
      label: t.myRides.title,
      icon: 'route',
      onSelect: pick(onMyRides),
    },
    {
      label: t.sidebar.cars,
      icon: 'car',
      onSelect: pick(onSharedCars),
      tour: 'sharedCars',
    },
    {
      label: t.sidebar.guide,
      icon: 'plug',
      onSelect: pick(onGuide),
    },
  ]
  // When something goes wrong, or there is something to say.
  const help: Item[] = [
    {
      label: t.howTo.menu,
      icon: 'book',
      onSelect: pick(onHowTo),
    },
    {
      label: t.whatsNew.menu,
      icon: 'sparkle',
      onSelect: pick(onWhatsNew),
    },
    {
      label: t.tour.menu,
      icon: 'book',
      onSelect: pick(onTour),
    },
    {
      label: t.support.title,
      icon: 'lifebuoy',
      onSelect: pick(onSupport),
    },
    {
      label: t.feedback.title,
      icon: 'bug',
      onSelect: pick(onFeedback),
    },
  ]
  // How the app behaves on this device and for this account.
  const settings: Item[] = [
    {
      label: t.notif.title,
      icon: 'bell',
      onSelect: pick(onNotifications),
    },
    ...(onInstall ? [{ label: t.install.menu, icon: 'install' as const, onSelect: pick(onInstall) }] : []),
  ]
  const admin: Item[] = isAdmin
    ? [
          {
            label: t.approvals.title,
            icon: 'approvals',
            onSelect: pick(onApprovals),
            count: approvals,
          },
          {
            label: t.garage.title,
            icon: 'garage',
            onSelect: pick(onGarage),
            count: garage,
          },
          {
            label: t.sidebar.people,
            icon: 'people',
            onSelect: pick(onPeople),
          },
          {
            label: t.sidebar.places,
            icon: 'map',
            onSelect: pick(onPlaces),
          },
          {
            label: t.rideLog.title,
            icon: 'table',
            onSelect: pick(onRideLog),
          },
          {
            label: t.adminLog.title,
            icon: 'log',
            onSelect: pick(onAdminLog),
          },
      ]
    : []

  const renderItem = (it: Item) => (
    <button key={it.label} type="button" className={flat ? 'group-row drawer-item' : 'drawer-item'} data-tour={it.tour} onClick={it.onSelect}>
      <span className="drawer-item-icon">
        <NavIcon name={it.icon} size={20} />
      </span>
      <span className="drawer-item-label">
        {it.label}
        {!!it.count && <span className="drawer-count" aria-label={t.approvals.count(it.count)}>{it.count}</span>}
      </span>
      {flat && <ChevronRightIcon size={16} className="group-chevron" />}
    </button>
  )

  if (flat) {
    const section = (title: string | null, items: Item[]) => (
      <section className="you-section" aria-label={title ?? t.common.menu}>
        {title && <h2 className="you-title">{title}</h2>}
        <div className="group">{items.map(renderItem)}</div>
      </section>
    )
    return (
      <div className="you">
        <button type="button" className="you-me" onClick={onAccount}>
          <Avatar name={userName || '?'} size="lg" />
          <span className="you-name">{userName}</span>
          <span className="you-handle">@{handle}</span>
        </button>
        <nav className="you-nav" aria-label={t.common.menu}>
          {section(null, daily)}
          {admin.length > 0 && section(t.sidebar.admin, admin)}
          {section(t.sidebar.settings, settings)}
          <div className="you-switches">
            <ThemeSwitch />
            <LanguageSwitch />
          </div>
          {section(t.sidebar.help, help)}
        </nav>
      </div>
    )
  }

  const group = (key: GroupKey, title: string, body: ReactNode, count = 0) => (
    <section className="drawer-group" aria-label={title}>
      <button
        type="button"
        className="drawer-group-head"
        aria-expanded={open[key]}
        aria-controls={`drawer-group-${key}`}
        onClick={() => toggle(key)}
      >
        <span className="drawer-group-chevron" aria-hidden="true">
          <ChevronRightIcon size={14} weight="bold" />
        </span>
        <span className="drawer-group-title">{title}</span>
        {!open[key] && count > 0 && <span className="drawer-count" aria-label={t.approvals.count(count)}>{count}</span>}
      </button>
      <div id={`drawer-group-${key}`} className={open[key] ? 'drawer-group-body' : 'drawer-group-body drawer-group-shut'} inert={!open[key]}>
        <div className="drawer-group-clip">{body}</div>
      </div>
    </section>
  )

  // Settings are their own card pinned to the foot, folding *upwards* out of
  // its head: the menu above gives up the room (it scrolls), so nothing ever
  // opens past the bottom edge.
  const settingsOpen = open.settings
  const settingsCard = (
    <section className={settingsOpen ? 'settings-card settings-card-open' : 'settings-card'} aria-label={t.sidebar.settings}>
      <div id="drawer-group-settings" className="settings-card-body" inert={!settingsOpen}>
        <div className="settings-card-clip">
          <div className="settings-card-items">{settings.map(renderItem)}</div>
          <div className="drawer-settings">
            <ThemeSwitch />
            <LanguageSwitch />
          </div>
        </div>
      </div>
      <button
        type="button"
        className="settings-card-head"
        aria-expanded={settingsOpen}
        aria-controls="drawer-group-settings"
        onClick={() => toggle('settings')}
      >
        <span className="drawer-item-icon">
          <NavIcon name="settings" size={20} />
        </span>
        <span className="drawer-group-title">{t.sidebar.settings}</span>
        <span className="settings-card-chevron" aria-hidden="true">
          <ChevronUpIcon size={16} weight="bold" />
        </span>
      </button>
    </section>
  )

  return (
    <>
        <div className="drawer-scroll">
          <button type="button" className="drawer-me" onClick={pick(onAccount)}>
            <Avatar name={userName || '?'} size="lg" />
            <span className="drawer-me-text">
              <span className="drawer-me-name">{userName}</span>
              <span className="drawer-me-hint">@{handle}</span>
            </span>
            <ChevronRightIcon size={18} className="drawer-me-chevron" />
          </button>

          <nav className="drawer-nav" aria-label={t.common.menu}>
            <div className="drawer-daily">{daily.map(renderItem)}</div>
            {admin.length > 0 && group('admin', t.sidebar.admin, admin.map(renderItem), approvals + garage)}
            {group('help', t.sidebar.help, help.map(renderItem))}
          </nav>
        </div>

        <div className="drawer-foot">{settingsCard}</div>
    </>
  )
}

/**
 * The menu on a wide screen: always there down the left edge, the way a desktop
 * app keeps its sidebar. The two places (*Rides*, *Cars*) are on top as the
 * view switch; under them, everything a phone keeps on its *You* tab. Nothing
 * to close, no backdrop, no history entry; an item opens its sheet directly.
 */
const DOCK_VIEWS: [View, NavName][] = [
  ['upcoming', 'calendar'],
  ['day', 'car'],
]

export function Dock({ view, onView, ...props }: Content) {
  const t = useT()
  return (
    <aside id="app-sidebar" className="drawer dock" aria-label="Karpul">
      <header className="drawer-head dock-head">
        <span className="topbar-title">
          <Logo /> Karpul
        </span>
      </header>
      <div className="dock-views" role="radiogroup" aria-label={t.view.label}>
        {DOCK_VIEWS.map(([v, mark]) => (
          <button key={v} type="button" role="radio" aria-checked={view === v} className={view === v ? 'drawer-item dock-view dock-view-on' : 'drawer-item dock-view'} data-tour={`tab-${v}`} onClick={() => onView(v)}>
            <span className="drawer-item-icon">
              <NavIcon name={mark} variant={view === v ? 'filled' : 'regular'} size={20} />
            </span>
            <span className="drawer-item-label">{t.view[v]}</span>
          </button>
        ))}
      </div>
      <SidebarBody {...props} />
    </aside>
  )
}

/**
 * A phone's third tab: you, and everything that is not about one ride. The
 * same menu as the dock, laid out as grouped lists on a page of its own (it
 * used to be a drawer behind a ☰, where half of it went unfound). Your account
 * is the block on top.
 */
export function YouPage({ view: _view, onView: _onView, ...props }: Content) {
  return <SidebarBody {...props} flat />
}
