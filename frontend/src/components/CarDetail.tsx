import { useState } from 'react'
import { firstName, fmtDayDate, fmtDayLabel, fmtTime, shortCarName } from '../lib/dates'
import { useT } from '../lib/i18n'
import { drives, inRide, isMyBooking, myBooking as findMyBooking, myWaitlistEntry, placeInLine, runs, useMe } from '../lib/me'
import { hasPins, routeUrl, stopHint } from '../lib/maps'
import { useArrivals } from '../lib/motion'
import { keepsKm } from '../lib/odometer'
import { goesToGarage } from '../lib/offices'
import { canSayHere, hasLeft, isToday, useClock } from '../lib/pickup'
import { givable, type Person } from '../lib/people'
import { mapsOn, useMapConfig, useMapsAllowed } from '../lib/places'
import { allStops, MAX_STOPS, type NewStop } from '../lib/stops'
import { telHref } from '../lib/support'
import type { CarState, Ride, RideInput, RideRequest } from '../lib/types'
import { carModel, carPaint } from '../lib/carModels'
import { useWide } from '../lib/useWide'
import { AddStop } from './AddStop'
import { PickupSheet } from './PickupSheet'
import { RouteEditor } from './RouteEditor'
import { ChangeAsk, SuggestTime } from './ChangeAsk'
import { DriverCar } from './DriverCar'
import { LateRow } from './LateRow'
import { ApprovalAsk, DriverAsks, GiveCarAsk, OfficeMailAsk } from './RideAsks'
import { RideFacts } from './RideFacts'
import { TripRoute } from './TripRoute'
import { WaitLine } from './WaitLine'
import { Avatar } from './Avatar'
import { CarArt } from './CarArt'
import {
  ArrowRightIcon,
  CalendarIcon,
  CarIcon,
  ClockIcon,
  ChevronRightIcon,
  CopyIcon,
  HourglassIcon,
  KebabIcon,
  MapIcon,
  NavigateIcon,
  PencilIcon,
  PhoneIcon,
  PinIcon,
  CheckCircleIcon,
  RepeatIcon,
  ShareIcon,
  TrashIcon,
  UserIcon,
  UsersIcon,
  XIcon,
} from './icons'
import { Menu } from './Menu'
import { Odometer } from './Odometer'
import { PassengerPicker } from './PassengerPicker'
import { RideThread } from './RideThread'
import { RideMap, RouteMapSheet } from './RouteMap'
import { Select } from './Select'

interface Props {
  ride: Ride
  busy: boolean
  isPast: boolean
  /** Get in, at the origin ("") or one of the ride's stops, or at a new one put on the route at `newStop`. */
  onJoin: (ride: Ride, pickup: string, newStop?: NewStop | null) => void
  onLeave: (ride: Ride, bookingId: number) => void
  /** Your seat in another car that day; offered as "switch to this car". */
  switchFrom?: { ride: Ride; bookingId: number } | null
  onSwitch?: (ride: Ride, from: { ride: Ride; bookingId: number }, pickup: string, newStop?: NewStop | null) => void
  /** Move a passenger (yourself, or anyone if you may manage seats) to another pickup point, or a new one. */
  onMovePickup: (ride: Ride, bookingId: number, pickup: string, newStop?: NewStop | null) => void
  /** The route edited in `RouteEditor`, saved; resolves true when it went through. */
  onSaveRoute: (ride: Ride, patch: Partial<RideInput>) => Promise<boolean>
  onShare: (ride: Ride) => void
  /** "Add to calendar": the ride's .ics, as a download. */
  onDownloadCalendar: (ride: Ride) => void
  /** Remove this ride and the later ones of its weekly series. */
  onCancelFollowing: (ride: Ride) => void
  /** Put somebody else in the car (driver, or a passenger when the driver allows it). */
  /** Settles once the call is done, so the form can stay until the passenger is in. */
  onAddPassenger: (ride: Ride, person: Person) => Promise<void>
  onCancel: (ride: Ride) => void
  onEdit: (ride: Ride) => void
  onDuplicate: (ride: Ride) => void
  /** Admin: a shared car past the driver's one a week, let through or refused. */
  onApprove: (ride: Ride) => void
  onDecline: (ride: Ride) => void
  /** "This is me": take over a ride whose driver is a name with no account. */
  onClaim: (ride: Ride) => void
  /** A passenger drives a shared car whose driver cancelled (`needs_driver`). */
  onTakeOver: (ride: Ride) => void
  /** An admin puts someone at the wheel of a shared car whose driver cancelled. */
  onPickDriver: (ride: Ride, person: Person) => Promise<void>
  /** The driver (or an admin) hands the wheel to the passenger with this seat (asks first). */
  onGiveCar: (ride: Ride, bookingId: number) => void
  /** The driver (or an admin) confirms a ride from the shared car's paper log (`Ride.unconfirmed`). */
  onConfirmRide: (ride: Ride) => void
  /** Open the mail to the office about this shared car (CarMailSheet), for one nobody said went out. */
  onOfficeMail: (ride: Ride) => void
  /** A passenger's yes or no to the driver's change (`Ride.proposal`). */
  onAnswerChange: (ride: Ride, agree: boolean) => void
  /** Whoever asked takes it back: the driver a change, a passenger a suggestion. */
  onWithdrawChange: (ride: Ride) => void
  /** A passenger suggests another departure or return time (it goes to the driver first). */
  onSuggestTime: (ride: Ride, times: { departure_time?: string; return_time?: string }) => Promise<boolean>
  /** The driver's one tap on the day: tell the car the ride leaves `minutes` late. */
  onLate: (ride: Ride, minutes: number) => void
  /** A passenger's one tap on the day: "I'm at the pickup point" (or taking it back). */
  onHere: (ride: Ride, bookingId: number, here: boolean) => void
  /** Whoever runs the ride says, once it has left, that a passenger did not turn up (or takes it back). */
  onNoShow: (ride: Ride, bookingId: number, noShow: boolean) => void
  /** Opens the company-car guide (charging, the Mazda 6e); shown on company-car rides only. */
  onGuide?: () => void
  /** How the shared car stands (components/CarStatus.tsx), for the line under its name. */
  carState?: CarState | null
  onCarState?: () => void
  /** Queue for a seat in this full car, getting in at `pickup` once one frees up
   * (a new place, with `newStop`, goes on the route when the seat is yours). */
  onWait: (ride: Ride, pickup: string, newStop?: NewStop | null) => void
  /** Leave the queue (yourself), or take someone off it (the driver). */
  onLeaveLine: (ride: Ride, entryId: number) => void
  /** A shared car's odometer: runs the call and puts the ride it returns on the board. */
  onOdometer: (ride: Ride, call: () => Promise<Ride>) => void
  /** The ride's day is after today: its odometer waits for the day. */
  coming: boolean
  /** Your own open request that day, for the "on your way" hint (lib/maps.ts `stopHint`). */
  myRequest?: RideRequest
  /** Show the ride's map inline (a wide pane), rather than behind *Show on map*. */
  inlineMap?: boolean
  /** Something in the thread failed; the board says so in its toast. */
  onError: (text: string) => void
}

function openRoute(ride: Ride) {
  window.open(routeUrl(ride), '_blank', 'noopener,noreferrer')
}

/** The pickup choice that opens a field for a place not on the route yet. */
const ELSEWHERE = '\u0000elsewhere'

/**
 * The selected ride: who drives, when it leaves and comes back, where from and
 * to, and who is in the car. *Get in* asks where after the tap (`PickupSheet`).
 */
export function CarDetail({
  ride,
  busy,
  isPast,
  onJoin,
  onLeave,
  switchFrom = null,
  onSwitch,
  onMovePickup,
  onSaveRoute,
  onShare,
  onDownloadCalendar,
  onCancelFollowing,
  onAddPassenger,
  onCancel,
  onEdit,
  onDuplicate,
  onApprove,
  onDecline,
  onClaim,
  onTakeOver,
  onPickDriver,
  onGiveCar,
  onConfirmRide,
  onOfficeMail,
  onAnswerChange,
  onWithdrawChange,
  onSuggestTime,
  onLate,
  onHere,
  onNoShow,
  onGuide,
  carState = null,
  onCarState,
  onWait,
  onLeaveLine,
  onOdometer,
  coming,
  myRequest,
  inlineMap,
  onError,
}: Props) {
  const t = useT()
  const me = useMe()
  const isDriver = drives(ride, me)
  // The driver runs the ride; so may an admin, who schedules the cars (backend: _may_run).
  const runsIt = runs(ride, me)
  // The plate for the Beograd garage is the driver's and the admins' business.
  const showPlate = !!ride.plate && goesToGarage(ride.car_type, ride.destination) && (runsIt || isDriver)
  const myBooking = findMyBooking(ride, me)
  const full = ride.free_seats <= 0
  // A seat on offer stays on screen while a call is out (its buttons only go
  // disabled), so the card never flickers through "No passengers yet" before
  // the passenger arrives.
  // A ride from the paper log takes nobody until its driver confirms it
  // (backend: join_ride); whoever runs it may still put people in.
  const held = ride.unconfirmed && !runsIt
  const seatOnOffer = !isDriver && !myBooking && !full && !isPast && !held
  // Who may put other people in and take them out: the driver (or an admin)
  // always, the passengers while the driver has switched it on (backend: _may_manage_seats).
  const canManage = !isPast && (runsIt || (ride.passengers_manage && !!myBooking))
  const canAddOther = canManage && !full
  // A full car has a queue: the first seat that frees up goes to the first in line.
  const myEntry = myWaitlistEntry(ride, me)
  const line = placeInLine(ride, me)
  const canWait = full && !isDriver && !myBooking && !myEntry && !isPast && ride.seats > 0 && !ride.unconfirmed

  // On the day the card looks at the clock: *I'm at the pickup point* comes
  // up half an hour before the ride leaves, *Didn't turn up* once it has.
  const now = useClock(isToday(ride))
  const today = isToday(ride, now)
  const sayHere = canSayHere(ride, now)
  const left = hasLeft(ride, now)

  const [adding, setAdding] = useState(false)
  // *Give the car to a passenger*: the row asking who takes the wheel.
  const [giving, setGiving] = useState(false)
  // A ride waiting for a driver or for approval is not handed on (backend: give_car).
  const canGive = runsIt && ride.car_type === 'corporate' && !isPast && !ride.needs_driver && ride.approval !== 'pending' && givable(ride).length > 0
  // A passenger's "Suggest another time" sheet.
  const [suggesting, setSuggesting] = useState(false)
  const arrived = useArrivals(ride.bookings.map((b) => b.id))
  // Where you get in is asked after the tap: the route's places (`asking`), or
  // somewhere new put on the route (`choosing`), for a seat or a place in the queue.
  const [asking, setAsking] = useState<'join' | 'wait' | null>(null)
  const [choosing, setChoosing] = useState<'join' | 'wait' | null>(null)
  const [movingPickup, setMovingPickup] = useState<false | 'pick' | 'new'>(false)
  // Whoever runs the ride: the whole route on its own screen.
  const [editingRoute, setEditingRoute] = useState(false)
  const [showMap, setShowMap] = useState(false)
  const mapConfig = useMapConfig()
  // Without the maps (KARPUL_MAPS) none of this shows.
  const mapsAllowed = useMapsAllowed()
  const wide = useWide()
  const pinned = hasPins(ride) && mapsOn(mapConfig)
  const mapInline = pinned && (inlineMap ?? wide)
  // Your request that day starts near this route: offer to get in there.
  const hint = mapsAllowed && seatOnOffer ? stopHint(ride, myRequest) : null
  const hasStops = allStops(ride).length > 0
  // Off, a passenger picks from the route as it is; the driver still adds places.
  const mayAddStop = allStops(ride).length < MAX_STOPS && (ride.passengers_add_stops || runsIt)
  const pickupOptions = [
    ...ride.stops_before.map((s) => ({ value: s, label: s, hint: t.detail.beforeStart })),
    { value: '', label: ride.origin, hint: t.detail.start },
    ...ride.stops.map((s) => ({ value: s, label: s })),
  ]
  const withElsewhere = mayAddStop ? [...pickupOptions, { value: ELSEWHERE, label: t.detail.elsewhere }] : pickupOptions
  const choosingPlace = choosing !== null
  const switching = !!switchFrom && !!onSwitch
  // A route that is only its start, with nowhere new allowed, has nothing to ask.
  const asksPickup = hasStops || mayAddStop
  const joinAt = (place: string) => (switching ? onSwitch!(ride, switchFrom!, place) : onJoin(ride, place))
  const getIn = () => (asksPickup ? setAsking('join') : joinAt(''))
  const wait = () => (asksPickup ? setAsking('wait') : onWait(ride, ''))
  const getInAt = (place: string, where: NewStop) => {
    setChoosing(null)
    if (switching) onSwitch!(ride, switchFrom!, place, where)
    else onJoin(ride, place, where)
  }
  const getInLabel = switching ? t.detail.switchTo : t.detail.getIn
  const model = carModel(ride.car_name)
  const tagged = ride.needs_driver || ride.unconfirmed || ride.approval === 'pending' || ride.approval === 'approved' || !!ride.series_id


  function pickPassenger(person: Person) {
    if (busy) return
    // The picker stays until the new row is there, so the two swap in one step.
    void onAddPassenger(ride, person).then(() => setAdding(false))
  }

  const shareItems = [
    { label: t.detail.share, icon: <ShareIcon size={18} />, onSelect: () => onShare(ride) },
    {
      label: t.detail.addToCalendar,
      icon: <CalendarIcon size={18} />,
      // The .ics is an attachment that needs the token: fetched, then handed
      // to the browser as a download, which a phone opens in its calendar.
      onSelect: () => onDownloadCalendar(ride),
    },
  ]
  const mapItems = mapsAllowed ? [{ label: t.map.navigate, icon: <NavigateIcon size={18} />, onSelect: () => openRoute(ride) }] : []
  const menuItems = runsIt
    ? [
        ...(canGive ? [{ label: t.detail.giveCar, icon: <CarIcon size={18} />, onSelect: () => setGiving(true), disabled: busy }] : []),
        { label: t.detail.duplicate, icon: <CopyIcon size={18} />, onSelect: () => onDuplicate(ride), disabled: busy },
        ...shareItems,
        ...mapItems,
        { label: t.detail.removeRide, icon: <TrashIcon size={18} />, onSelect: () => onCancel(ride), danger: true, disabled: busy },
        ...(ride.series_id
          ? [{ label: t.detail.removeFollowing, icon: <RepeatIcon size={18} />, onSelect: () => onCancelFollowing(ride), danger: true, disabled: busy }]
          : []),
      ]
    : [
        ...(!ride.proposal && !isPast && !isDriver && myBooking?.passenger_id != null
          ? [{ label: t.detail.suggest, icon: <ClockIcon size={18} />, onSelect: () => setSuggesting(true) }]
          : []),
        { label: t.detail.duplicateMine, icon: <CopyIcon size={18} />, onSelect: () => onDuplicate(ride) },
        ...shareItems,
        ...mapItems,
      ]

  return (
    <div className="detail">
      {/* When, the way and the car, large; what the ride is for you under it. */}
      <header className="ride-head">
        <div className="ride-head-top">
          <span className="ride-head-day">
            {fmtDayLabel(ride.ride_date)} <small>{fmtDayDate(ride.ride_date)}</small>
          </span>
          <span className="ride-head-tools">
            {/* Editing is the thing whoever runs a ride does most: in plain sight, and only here (not again in the menu). */}
            {runsIt && (
              <button type="button" className="btn btn-sm driver-edit" disabled={busy} onClick={() => onEdit(ride)}>
                {t.detail.editShort}
              </button>
            )}
            <Menu trigger={<KebabIcon />} label={t.detail.rideOptions} items={menuItems} />
          </span>
        </div>
        <div className="ride-head-row">
          <span className="ride-head-time">{fmtTime(ride.departure_time)}</span>
          {model && <CarArt model={model.key} paint={carPaint(ride.car_name)} width={150} className="ride-head-car" />}
        </div>
        <strong className="ride-head-route">
          {ride.origin}
          <ArrowRightIcon size={18} weight="bold" />
          {ride.destination}
        </strong>
        <span className="ride-head-sub">
          {ride.return_time ? `${t.detail.returns} ${fmtTime(ride.return_time)}` : t.detail.oneWay} · {shortCarName(ride.car_name)}
        </span>
        {(isDriver || myBooking || tagged) && (
          <span className="ride-head-tags">
            {isDriver && <span className="ride-chip">{t.upcoming.driving}</span>}
            {!isDriver && myBooking && (
              <span className="ride-chip">
                <CheckCircleIcon size={18} weight="bold" />
                {t.upcoming.youreIn} · {myBooking.pickup || ride.origin}
              </span>
            )}
            {ride.needs_driver && <span className="tag tag-amber">{t.detail.needsDriver}</span>}
            {ride.unconfirmed && <span className="tag tag-amber">{t.detail.unconfirmed}</span>}
            {ride.approval === 'pending' && <span className="tag tag-amber">{t.detail.awaiting}</span>}
            {ride.approval === 'approved' && <span className="tag tag-green">{t.detail.approved}</span>}
            {ride.series_id && (
              <span className="driver-weekly" title={t.form.repeatWeekly}>
                <RepeatIcon size={13} /> {t.detail.weekly}
              </span>
            )}
          </span>
        )}
      </header>

      <div className="ride-asks">
        {ride.approval === 'pending' && me.admin && !isPast && <ApprovalAsk ride={ride} busy={busy} onApprove={onApprove} onDecline={onDecline} />}

        {ride.proposal && !isPast && (
          <ChangeAsk
            ride={ride}
            busy={busy}
            onAnswer={(agree) => onAnswerChange(ride, agree)}
            onWithdraw={runsIt || ride.proposal.by_id === me.id ? () => onWithdrawChange(ride) : undefined}
          />
        )}

        {suggesting && (
          <SuggestTime
            ride={ride}
            busy={busy}
            onClose={() => setSuggesting(false)}
            onSend={(times) => {
              void onSuggestTime(ride, times).then((ok) => ok && setSuggesting(false))
            }}
          />
        )}

        <DriverAsks
          ride={ride}
          busy={busy}
          runsIt={runsIt}
          isDriver={isDriver}
          isPast={isPast}
          seated={!!myBooking}
          onTakeOver={onTakeOver}
          onPickDriver={onPickDriver}
          onCancelRide={onCancel}
          onConfirmRide={onConfirmRide}
          onClaim={onClaim}
        />

        {giving && canGive && (
          <GiveCarAsk
            ride={ride}
            busy={busy}
            onGive={(bookingId) => {
              setGiving(false)
              onGiveCar(ride, bookingId)
            }}
            onClose={() => setGiving(false)}
          />
        )}

        {!isPast && <OfficeMailAsk ride={ride} runsIt={runsIt} isDriver={isDriver} onWrite={onOfficeMail} />}

        {isDriver && <LateRow ride={ride} busy={busy} onLate={onLate} />}
      </div>

      <section className="pax">
        <h3 className="section-title">
          {t.detail.passengersTitle}{' '}
          <span className="section-count">
            {ride.bookings.length} / {ride.seats}
          </span>
          {ride.passengers_manage && (
            <span className="tag tag-icon section-tag" title={t.detail.openListTitle}>
              <UsersIcon size={12} strokeWidth={2.25} /> {t.detail.openList}
            </span>
          )}
        </h3>

        {hint && !choosingPlace && (
          <div className="banner stop-hint">
            <PinIcon size={20} />
            <span>{t.map.hint(hint.place, hint.near)}</span>
            <button
              type="button"
              className="btn btn-sm btn-primary"
              disabled={busy}
              onClick={() => getInAt(hint.place, { ...hint.where, point: hint.point })}
            >
              {t.map.hintGetIn(hint.place)}
            </button>
          </div>
        )}

        {asking && (
          <PickupSheet
            ride={ride}
            busy={busy}
            elsewhere={mayAddStop}
            onClose={() => setAsking(null)}
            onPick={(place) => {
              const what = asking
              setAsking(null)
              if (what === 'join') joinAt(place)
              else onWait(ride, place)
            }}
            onElsewhere={() => {
              setChoosing(asking)
              setAsking(null)
            }}
          />
        )}

        {choosing && (seatOnOffer || canWait) && (
          <AddStop
            ride={ride}
            submitLabel={choosing === 'join' && seatOnOffer ? getInLabel : t.detail.waitFor}
            busy={busy}
            onCancel={() => setChoosing(null)}
            onSubmit={
              choosing === 'join' && seatOnOffer
                ? getInAt
                : (place, where) => {
                    setChoosing(null)
                    onWait(ride, place, where)
                  }
            }
          />
        )}

        <ul className="group pax-list">
          <li className="pax-slot">
            <div className="pax-row pax-driver">
              <Avatar name={ride.driver_name} />
              <span className="pax-name">
                <span className="pax-name-row">
                  <span className="pax-name-text">{ride.driver_name}</span>
                  {isDriver && <span className="tag">{t.detail.you}</span>}
                  {ride.driver_id === null && <span className="tag tag-muted">{t.detail.noAccount}</span>}
                </span>
                <span className="pax-pickup">{t.detail.driver}</span>
              </span>
              {ride.driver_phone && !isDriver && (
                <a className="icon-btn pax-call" href={telHref(ride.driver_phone)} aria-label={`${t.detail.callDriver} ${ride.driver_phone}`} title={ride.driver_phone}>
                  <PhoneIcon size={18} />
                </a>
              )}
            </div>
          </li>
            {ride.bookings.map((b) => {
              const mine = isMyBooking(b, me)
              // Someone new grows into the list; your own row takes the place of the get-in row you tapped.
              return (
                <li key={b.id} className={arrived.has(b.id) && !mine ? 'pax-slot pax-slot-new' : 'pax-slot'}>
                  <div className={mine ? 'pax-row pax-row-me' : 'pax-row'}>
                    <Avatar name={b.passenger_name} />
                    <span className="pax-name">
                      <span className="pax-name-row">
                        <span className="pax-name-text">{b.passenger_name}</span>
                        {mine && <span className="tag">{t.detail.you}</span>}
                      </span>
                      {(hasStops || (mine && !isPast)) && (
                        <span className="pax-pickup">
                          <PinIcon size={12} /> {t.detail.getsInAt(b.pickup || ride.origin)}
                          {mine && !isPast && !movingPickup && (
                            <button type="button" className="soft-action soft-action-plain soft-action-xs" disabled={busy} onClick={() => setMovingPickup('pick')}>
                              {t.common.edit}
                            </button>
                          )}
                        </span>
                      )}
                      {mine && movingPickup === 'new' && (
                        <AddStop
                          ride={ride}
                          submitLabel={t.common.save}
                          busy={busy}
                          onCancel={() => setMovingPickup(false)}
                          onSubmit={(place, where) => {
                            setMovingPickup(false)
                            onMovePickup(ride, b.id, place, where)
                          }}
                        />
                      )}
                      {mine && movingPickup === 'pick' && (
                        <span className="pax-pickup-pick">
                          <Select
                            label={t.detail.changePickup}
                            icon={<PinIcon size={16} />}
                            value={b.pickup}
                            options={withElsewhere}
                            onChange={(v) => {
                              if (v === ELSEWHERE) return setMovingPickup('new')
                              setMovingPickup(false)
                              if (v !== b.pickup) onMovePickup(ride, b.id, v)
                            }}
                          />
                          <button type="button" className="icon-btn icon-btn-sm" aria-label={t.common.cancel} onClick={() => setMovingPickup(false)}>
                            <XIcon size={16} />
                          </button>
                        </span>
                      )}
                      {b.no_show && (runsIt || mine) && <span className="tag tag-amber pax-signal">{t.detail.noShow}</span>}
                      {!b.no_show && b.here_at && today && (
                        <span className="pax-signal-row">
                          <span className="tag tag-green tag-icon pax-signal">
                            <PinIcon size={12} strokeWidth={2.25} /> {t.detail.here}
                          </span>
                          {mine && (
                            <button type="button" className="link link-sm" disabled={busy} onClick={() => onHere(ride, b.id, false)}>
                              {t.detail.notHere}
                            </button>
                          )}
                        </span>
                      )}
                      {runsIt && left && !mine && (
                        <button type="button" className="link link-sm pax-noshow" disabled={busy} onClick={() => onNoShow(ride, b.id, !b.no_show)}>
                          {b.no_show ? t.detail.turnedUp : t.detail.didNotTurnUp}
                        </button>
                      )}
                    </span>
                    {canManage && !mine && (
                      <button
                        type="button"
                        className="icon-btn icon-btn-sm"
                        title={t.detail.removeName(b.passenger_name)}
                        aria-label={t.detail.removeName(b.passenger_name)}
                        disabled={busy}
                        onClick={() => onLeave(ride, b.id)}
                      >
                        <XIcon size={16} />
                      </button>
                    )}
                    {mine && !isDriver && !isPast && (
                      <button
                        type="button"
                        className="soft-action soft-action-plain pax-leave"
                        disabled={busy}
                        onClick={() => onLeave(ride, b.id)}
                      >
                        {t.detail.leave}
                      </button>
                    )}
                  </div>
                </li>
              )
            })}
          {(ride.free_seats > 0 || ride.bookings.length === 0) && (
            <li className="pax-slot">
              <div className="pax-row pax-free">
                <span className="pax-empty" aria-hidden="true" />
                <span className="pax-name">
                  <span className="pax-pickup">
                    {ride.free_seats > 0 ? t.detail.seatsFree(ride.free_seats) : isPast ? t.detail.nobodyRode : full ? t.detail.noSeatsOffered : t.detail.noPassengers}
                  </span>
                  {ride.bookings.length === 0 && ride.free_seats > 0 && <span className="sr-only">{isPast ? t.detail.nobodyRode : t.detail.noPassengers}</span>}
                </span>
              </div>
            </li>
          )}
        </ul>
        {seatOnOffer && !choosingPlace && switching && <p className="hint hint-tight">{t.detail.switchHint(firstName(switchFrom!.ride.driver_name))}</p>}


        {canAddOther && !adding && (
          <button type="button" className="add-row add-row-quiet" disabled={busy} onClick={() => setAdding(true)}>
            <UserIcon size={18} />
            {t.detail.addColleague}
          </button>
        )}
        {canAddOther && adding && (
          <PassengerPicker ride={ride} busy={busy} onPick={pickPassenger} onCancel={() => setAdding(false)} />
        )}

        {full && !myBooking && !isDriver && ride.bookings.length > 0 && !myEntry && <p className="hint">{t.detail.full}</p>}

        {canWait && !choosingPlace && <p className="hint hint-tight">{t.detail.waitHint}</p>}
        {myEntry && !isPast && (
          <div className="banner waitline-me">
            <HourglassIcon size={22} />
            <span>{t.detail.inLine(line)}</span>
            <button type="button" className="link" disabled={busy} onClick={() => onLeaveLine(ride, myEntry.id)}>
              {t.detail.stopWaiting}
            </button>
          </div>
        )}
        {ride.waitlist.length > 0 && <WaitLine ride={ride} isDriver={isDriver} isPast={isPast} busy={busy} onLeaveLine={onLeaveLine} />}
      </section>

      <article className="card driver-card">
        <TripRoute ride={ride} />
        {mapInline && <RideMap ride={ride} className="ride-map-inline" />}
        {pinned && !mapInline && (
          <button type="button" className="btn btn-block trip-map-open" onClick={() => setShowMap(true)}>
            <MapIcon size={18} />
            {t.map.showMap}
            <ChevronRightIcon size={16} className="trip-map-open-chevron" />
          </button>
        )}
        {showMap && <RouteMapSheet ride={ride} onClose={() => setShowMap(false)} />}
        {/* The whole route on one screen, *Add a pickup point* included. A passenger
            puts a new place on the route through *Get in* or their pickup's *Edit*. */}
        {runsIt && !isPast && (
          <span className="trip-actions">
            <button type="button" className="soft-action" disabled={busy} onClick={() => setEditingRoute(true)}>
              <PencilIcon size={14} /> {t.detail.editRoute}
            </button>
          </span>
        )}
        {runsIt && !isPast && editingRoute && (
          <RouteEditor
            ride={ride}
            busy={busy}
            onClose={() => setEditingRoute(false)}
            onSave={async (patch) => {
              if (await onSaveRoute(ride, patch)) setEditingRoute(false)
            }}
          />
        )}

        <DriverCar ride={ride} carState={carState} onCarState={onCarState} onGuide={onGuide} />

        <RideFacts ride={ride} isDriver={isDriver} showPlate={showPlate} showMail={runsIt} />
      </article>

      {/* The kilometres: kept by whoever is in the car, read by the admins. */}
      {keepsKm(ride) && (me.admin || inRide(ride, me)) && (!coming || ride.legs.length > 0) && (
        <Odometer ride={ride} busy={busy} coming={coming} onOdometer={onOdometer} />
      )}


      <RideThread ride={ride} isDriver={isDriver} onError={onError} />

      {/* The one thing your place in this ride lets you do now, pinned to the foot of the screen. */}
      {seatOnOffer && !choosingPlace ? (
        <div className="ride-bar">
          <button type="button" className="btn btn-primary btn-block" disabled={busy} onClick={getIn}>
            {getInLabel}
          </button>
        </div>
      ) : canWait && !choosingPlace ? (
        <div className="ride-bar">
          <button type="button" className="btn btn-primary btn-block" disabled={busy} onClick={wait}>
            {t.detail.waitFor}
          </button>
        </div>
      ) : myBooking && sayHere && !myBooking.here_at && !myBooking.no_show && !movingPickup ? (
        <div className="ride-bar">
          <button type="button" className="btn btn-primary btn-block" disabled={busy} onClick={() => onHere(ride, myBooking.id, true)}>
            {t.detail.imHere}
          </button>
        </div>
      ) : null}
    </div>
  )
}
