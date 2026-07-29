import { useState, useEffect, useRef, createContext, useContext, type ReactNode } from 'react'
import fotoCapa from './imports/Foto_Capa.jpg'
import fotoFundoInicio from './imports/Foto_Fundo_Inicio.jpg'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, CartesianGrid, RadarChart, Radar, PolarGrid, PolarAngleAxis,
} from 'recharts'
import {
  Home, Trophy, Users, Calendar, Star, Settings, ChevronRight,
  TrendingUp, TrendingDown, Minus, MapPin, Clock, Award,
  Search, Bell, ArrowLeft, Shield, Target,
  Activity, Vote, Crown, Flame, CheckCircle,
  BarChart2, Zap, Eye, Heart,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type Page = 'home' | 'rankings' | 'players' | 'matches' | 'rate' | 'admin' | 'profile' | 'match-detail'
type Rarity = 'bronze' | 'silver' | 'gold' | 'legendary'
type Pos = 'GK' | 'CB' | 'LB' | 'RB' | 'CDM' | 'CM' | 'CAM' | 'LW' | 'RW' | 'ST'

interface Player {
  id: number; name: string; short: string; pos: Pos; rating: number;
  votes: number; flag: string; rarity: Rarity; num: number; goals: number;
  assists: number; matches: number; trend: 'up' | 'down' | 'stable';
  nat: string; age: number; cleanSheets?: number; saves?: number; photo?: string;
}

interface Match {
  id: number; home: string; away: string; homeScore: number; awayScore: number;
  date: string; comp: string; status: 'live' | 'finished' | 'upcoming';
  minute?: number; venue: string; round: string;
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const MOCK_PLAYERS: Player[] = [
  { id: 1, name: 'Matheus Pereira', short: 'M. Pereira', pos: 'CAM', rating: 8.7, votes: 12840, flag: '🇧🇷', rarity: 'legendary', num: 10, goals: 14, assists: 11, matches: 32, trend: 'up', nat: 'Brasil', age: 28 },
  { id: 2, name: 'Cássio', short: 'Cássio', pos: 'GK', rating: 8.2, votes: 9320, flag: '🇧🇷', rarity: 'gold', num: 12, goals: 0, assists: 0, matches: 34, trend: 'stable', nat: 'Brasil', age: 37, cleanSheets: 14, saves: 89 },
  { id: 3, name: 'Kaio Jorge', short: 'Kaio Jorge', pos: 'ST', rating: 7.9, votes: 8760, flag: '🇧🇷', rarity: 'gold', num: 9, goals: 11, assists: 4, matches: 28, trend: 'up', nat: 'Brasil', age: 22 },
  { id: 4, name: 'Matheus Henrique', short: 'M. Henrique', pos: 'CM', rating: 7.6, votes: 7240, flag: '🇧🇷', rarity: 'gold', num: 8, goals: 3, assists: 7, matches: 33, trend: 'stable', nat: 'Brasil', age: 27 },
  { id: 5, name: 'Lucas Silva', short: 'Lucas Silva', pos: 'CDM', rating: 7.3, votes: 5180, flag: '🇧🇷', rarity: 'silver', num: 6, goals: 1, assists: 3, matches: 30, trend: 'stable', nat: 'Brasil', age: 34 },
  { id: 6, name: 'Zé Ivaldo', short: 'Zé Ivaldo', pos: 'CB', rating: 7.1, votes: 4820, flag: '🇧🇷', rarity: 'silver', num: 4, goals: 2, assists: 1, matches: 29, trend: 'up', nat: 'Brasil', age: 27 },
  { id: 7, name: 'Ramiro', short: 'Ramiro', pos: 'CM', rating: 7.0, votes: 4560, flag: '🇧🇷', rarity: 'silver', num: 7, goals: 4, assists: 5, matches: 26, trend: 'down', nat: 'Brasil', age: 31 },
  { id: 8, name: 'Marlon Santos', short: 'Marlon', pos: 'LB', rating: 6.9, votes: 3940, flag: '🇧🇷', rarity: 'silver', num: 3, goals: 0, assists: 4, matches: 31, trend: 'stable', nat: 'Brasil', age: 30 },
  { id: 9, name: 'Gabriel Veron', short: 'G. Veron', pos: 'RW', rating: 6.7, votes: 3280, flag: '🇧🇷', rarity: 'bronze', num: 11, goals: 3, assists: 6, matches: 22, trend: 'up', nat: 'Brasil', age: 22 },
  { id: 10, name: 'João Marcelo', short: 'J. Marcelo', pos: 'CB', rating: 6.5, votes: 2940, flag: '🇧🇷', rarity: 'bronze', num: 3, goals: 1, assists: 1, matches: 24, trend: 'down', nat: 'Brasil', age: 21 },
]

const MOCK_MATCHES: Match[] = [
  { id: 1, home: 'Cruzeiro', away: 'Flamengo', homeScore: 2, awayScore: 1, date: 'Hoje', comp: 'Brasileirão Série A', status: 'live', minute: 67, venue: 'Mineirão, Belo Horizonte', round: 'Rodada 18' },
  { id: 2, home: 'Atlético-MG', away: 'Cruzeiro', homeScore: 0, awayScore: 3, date: '07 Jul 2024', comp: 'Brasileirão Série A', status: 'finished', venue: 'Arena MRV, BH', round: 'Rodada 17' },
  { id: 3, home: 'Cruzeiro', away: 'Palmeiras', homeScore: 1, awayScore: 1, date: '03 Jul 2024', comp: 'Brasileirão Série A', status: 'finished', venue: 'Mineirão, BH', round: 'Rodada 16' },
  { id: 4, home: 'Botafogo', away: 'Cruzeiro', homeScore: 1, awayScore: 2, date: '28 Jun 2024', comp: 'Brasileirão Série A', status: 'finished', venue: 'Nilton Santos, RJ', round: 'Rodada 15' },
  { id: 5, home: 'Cruzeiro', away: 'Internacional', homeScore: 0, awayScore: 0, date: '20 Jul 2024', comp: 'Brasileirão Série A', status: 'upcoming', venue: 'Mineirão, BH', round: 'Rodada 19' },
]

const CHART_DATA = [
  { m: 'BOT', r: 7.8, votes: 4320 }, { m: 'PAL', r: 7.2, votes: 3840 },
  { m: 'COR', r: 8.1, votes: 5120 }, { m: 'ATL', r: 9.1, votes: 8920 },
  { m: 'GRE', r: 8.8, votes: 6540 }, { m: 'FLA', r: 8.0, votes: 7210 },
  { m: 'ATM', r: 8.5, votes: 9280 }, { m: 'HOJ', r: 8.7, votes: 12840 },
]

const RARITY_CFG = {
  bronze: {
    bg: 'linear-gradient(145deg, #2A1200 0%, #6B3010 40%, #A05828 65%, #6B3010 100%)',
    photoGrad: 'linear-gradient(180deg, #8B4020 0%, #2A1000 100%)',
    accent: '#C48040', glow: 'bronze', label: 'BRONZE',
    border: 'rgba(164, 88, 40, 0.5)',
  },
  silver: {
    bg: 'linear-gradient(145deg, #141E2A 0%, #2A3848 40%, #506070 65%, #2A3848 100%)',
    photoGrad: 'linear-gradient(180deg, #506070 0%, #141E2A 100%)',
    accent: '#9AAAB8', glow: 'silver', label: 'PRATA',
    border: 'rgba(80, 96, 112, 0.5)',
  },
  gold: {
    bg: 'linear-gradient(145deg, #160E00 0%, #5A3C08 40%, #A87820 65%, #5A3C08 100%)',
    photoGrad: 'linear-gradient(180deg, #C4982A 0%, #2A1800 100%)',
    accent: '#E8C840', glow: 'gold', label: 'OURO',
    border: 'rgba(196, 151, 42, 0.5)',
  },
  legendary: {
    bg: 'linear-gradient(145deg, #040A18 0%, #081830 30%, #0C2048 55%, #162A60 75%, #0A1C38 100%)',
    photoGrad: 'linear-gradient(180deg, #1A50B0 0%, #040A18 100%)',
    accent: '#C4972A', glow: 'legendary', label: 'LENDÁRIO',
    border: 'rgba(196, 151, 42, 0.6)',
  },
}

const POS_COLORS: Record<Pos, string> = {
  GK: '#F59E0B', CB: '#3B82F6', LB: '#3B82F6', RB: '#3B82F6',
  CDM: '#6366F1', CM: '#6366F1', CAM: '#8B5CF6',
  LW: '#10B981', RW: '#10B981', ST: '#EF4444',
}

// ─── Utilities ────────────────────────────────────────────────────────────────

const fmtRating = (r: number) => r > 0 ? r.toFixed(1) : '–'
const fmtVotes = (v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}K` : v.toString()
const isCruzeiro = (team: string) => team === 'Cruzeiro'

// ─── Real data (Supabase) ───────────────────────────────────────────────────
// Live squad + fixtures come from the JeanScore Supabase project via its REST
// API (publishable/anon key — read-only). The mock arrays above are kept only
// as the initial seed (so the UI never renders empty) and for the home hero
// showcase. Player ratings/votes are 0 until the community voting is wired up,
// since the `game_scores` table is still empty.

const SUPABASE_URL = 'https://ozsissvmrniwmgxsgzdh.supabase.co'
const SUPABASE_KEY = 'sb_publishable_gke_OLA7RhoTCuunJrJzoA_a9vX4GUp'

interface DbSquadRow {
  id: string
  name: string
  position: 'Goalkeeper' | 'Defender' | 'Midfielder' | 'Attacker'
  number: string | null
  photo: string | null
  nationality: string | null
}

interface DbFixtureRow {
  id: string
  home_team: string
  away_team: string
  home_score: number | null
  away_score: number | null
  fixture_date: string
  ts: number
  competition: string
  stadium: string | null
  status: string
}

const POS_BY_CATEGORY: Record<DbSquadRow['position'], Pos> = {
  Goalkeeper: 'GK',
  Defender: 'CB',
  Midfielder: 'CM',
  Attacker: 'ST',
}

const FLAG_BY_NATIONALITY: Record<string, string> = {
  Brazil: '🇧🇷', Uruguay: '🇺🇾', Colombia: '🇨🇴', Argentina: '🇦🇷',
  Ecuador: '🇪🇨', Venezuela: '🇻🇪', Paraguay: '🇵🇾', Chile: '🇨🇱',
}

const NAT_PT: Record<string, string> = {
  Brazil: 'Brasil', Uruguay: 'Uruguai', Colombia: 'Colômbia', Argentina: 'Argentina',
  Ecuador: 'Equador', Venezuela: 'Venezuela', Paraguay: 'Paraguai', Chile: 'Chile',
}

function shortName(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length < 2) return name
  return `${parts[0][0]}. ${parts[parts.length - 1]}`
}

function mapSquadRowToPlayer(row: DbSquadRow, index: number): Player {
  const nat = row.nationality ?? 'Brazil'
  return {
    id: index + 1,
    name: row.name,
    short: shortName(row.name),
    pos: POS_BY_CATEGORY[row.position] ?? 'CM',
    rating: 0,
    votes: 0,
    flag: FLAG_BY_NATIONALITY[nat] ?? '⚽',
    rarity: 'bronze',
    num: row.number ? parseInt(row.number, 10) : 0,
    goals: 0,
    assists: 0,
    matches: 0,
    trend: 'stable',
    nat: NAT_PT[nat] ?? nat,
    age: 0,
    photo: row.photo ?? undefined,
  }
}

function fmtFixtureDate(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function mapFixtureRowToMatch(row: DbFixtureRow, index: number): Match {
  return {
    id: index + 1,
    home: row.home_team,
    away: row.away_team,
    homeScore: row.home_score ?? 0,
    awayScore: row.away_score ?? 0,
    date: fmtFixtureDate(row.fixture_date),
    comp: row.competition,
    status: row.status === 'finished' ? 'finished' : 'upcoming',
    venue: row.stadium ?? '',
    round: '',
  }
}

interface DbStandingRow {
  position: number
  team: string
  played: number
  wins: number
  draws: number
  losses: number
  goals_for: number
  goals_against: number
  goal_diff: number
  points: number
  is_cruzeiro: boolean
}

interface DbCompetitionStatus {
  id: string
  competition: string
  status: string | null
  stage: string | null
  next_match: string | null
  next_date: string | null
  sort: number
}

interface JeanData {
  players: Player[]
  matches: Match[]
  standings: DbStandingRow[]
  competitions: DbCompetitionStatus[]
  loading: boolean
}

const DataContext = createContext<JeanData>({ players: MOCK_PLAYERS, matches: MOCK_MATCHES, standings: [], competitions: [], loading: true })

function useData(): JeanData {
  return useContext(DataContext)
}

async function supaGet<T>(path: string): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  })
  if (!res.ok) throw new Error(`Supabase ${res.status}`)
  return res.json() as Promise<T>
}

function DataProvider({ children }: { children: ReactNode }) {
  const [players, setPlayers] = useState<Player[]>(MOCK_PLAYERS)
  const [matches, setMatches] = useState<Match[]>(MOCK_MATCHES)
  const [standings, setStandings] = useState<DbStandingRow[]>([])
  const [competitions, setCompetitions] = useState<DbCompetitionStatus[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const [squad, fixtures] = await Promise.all([
          supaGet<DbSquadRow[]>('squad?select=id,name,position,number,photo,nationality&order=name.asc'),
          supaGet<DbFixtureRow[]>('fixtures?select=id,home_team,away_team,home_score,away_score,fixture_date,ts,competition,stadium,status'),
        ])
        if (!active) return
        if (squad.length > 0) {
          setPlayers(squad.map(mapSquadRowToPlayer))
        }
        if (fixtures.length > 0) {
          // Most recent results first, then upcoming fixtures in chronological order.
          const finished = fixtures.filter((f) => f.status === 'finished').sort((a, b) => b.ts - a.ts)
          const upcoming = fixtures.filter((f) => f.status !== 'finished').sort((a, b) => a.ts - b.ts)
          setMatches([...finished, ...upcoming].map(mapFixtureRowToMatch))
        }
      } catch (err) {
        console.error('Failed to load JeanScore data from Supabase', err)
      }

      // Standings + competition status are optional (tables may not exist yet).
      try {
        const s = await supaGet<DbStandingRow[]>('standings?select=*&order=position.asc')
        if (active && s.length > 0) setStandings(s)
      } catch { /* standings table not available */ }
      try {
        const c = await supaGet<DbCompetitionStatus[]>('competition_status?select=*&order=sort.asc')
        if (active && c.length > 0) setCompetitions(c)
      } catch { /* competition_status table not available */ }

      if (active) setLoading(false)
    })()
    return () => {
      active = false
    }
  }, [])

  return (
    <DataContext.Provider value={{ players, matches, standings, competitions, loading }}>
      {children}
    </DataContext.Provider>
  )
}

// ─── Small Components ─────────────────────────────────────────────────────────

function JeanScoreLogo({ width = 220, showStars = true }: { width?: number; showStars?: boolean }) {
  const viewW = 272
  const viewH = showStars ? 98 : 60
  const h = Math.round(width * viewH / viewW)

  // 5-pointed star polygon centered at (cx, cy) with outer radius r
  const star = (cx: number, cy: number, r: number) =>
    Array.from({ length: 10 }, (_, i) => {
      const a = (i * 36 - 90) * Math.PI / 180
      const rad = i % 2 === 0 ? r : r * 0.42
      return `${(cx + rad * Math.cos(a)).toFixed(1)},${(cy + rad * Math.sin(a)).toFixed(1)}`
    }).join(' ')

  return (
    <svg viewBox={`0 0 ${viewW} ${viewH}`} width={width} height={h} style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        {/* White → ice-blue for "Jean" */}
        <linearGradient id="jsWh" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#C8DCFF" />
        </linearGradient>
        {/* Navy → royal blue for "Score" letters */}
        <linearGradient id="jsBl" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#5A9FEC" />
          <stop offset="100%" stopColor="#003087" />
        </linearGradient>
      </defs>

      {/* ── "Jean" – white ── */}
      <text x="2" y="50"
        fontFamily="'Plus Jakarta Sans', system-ui, sans-serif"
        fontWeight="900" fontSize="48" fill="url(#jsWh)">Jean</text>

      {/* ── "Sc" – blue ── */}
      <text x="122" y="50"
        fontFamily="'Plus Jakarta Sans', system-ui, sans-serif"
        fontWeight="900" fontSize="48" fill="url(#jsBl)">Sc</text>

      {/* ── "o" – WHITE circle, navy up/down arrows ── */}
      <circle cx="197" cy="32" r="21" fill="white" />
      <circle cx="197" cy="32" r="21" fill="none" stroke="#1A5FCC" strokeWidth="1.5" />
      {/* Up arrow ▲ */}
      <polyline points="189,35 197,24 205,35"
        fill="none" stroke="#003087" strokeWidth="3.5"
        strokeLinecap="round" strokeLinejoin="round" />
      {/* Down arrow ▼ */}
      <polyline points="189,29 197,40 205,29"
        fill="none" stroke="#003087" strokeWidth="3.5"
        strokeLinecap="round" strokeLinejoin="round" />

      {/* ── "re" – blue ── */}
      <text x="220" y="50"
        fontFamily="'Plus Jakarta Sans', system-ui, sans-serif"
        fontWeight="900" fontSize="48" fill="url(#jsBl)">re</text>

      {/* ── Southern Cross – 5 white stars matching Cruzeiro shield ──
           Positions mirror the shield's cross arms:
           γ (top arm), β (left arm), α (bottom arm, largest),
           δ (right arm), ε (small, inner-right)                      */}
      {showStars && <>
        {/* γ Gamma – top */}
        <polygon points={star(132, 67, 5)} fill="white" />
        {/* β Beta – left */}
        <polygon points={star(114, 78, 5)} fill="white" />
        {/* α Alpha – bottom center, brightest/largest */}
        <polygon points={star(130, 90, 6.5)} fill="white" />
        {/* δ Delta – right */}
        <polygon points={star(153, 74, 5)} fill="white" />
        {/* ε Epsilon – small inner star */}
        <polygon points={star(146, 84, 3)} fill="white" />
      </>}
    </svg>
  )
}

function CruzeiroCrest({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size * 1.15} viewBox="0 0 40 46" fill="none">
      <defs>
        <linearGradient id="sg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1A5FCC" />
          <stop offset="100%" stopColor="#003087" />
        </linearGradient>
        <linearGradient id="gg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#E8C840" />
          <stop offset="100%" stopColor="#C4972A" />
        </linearGradient>
      </defs>
      <path d="M20 1L1 7V27C1 37 11 43.5 20 46C29 43.5 39 37 39 27V7L20 1Z" fill="url(#sg)" />
      <path d="M20 4L4 9.5V27C4 35.5 12.5 41.5 20 43.5V4Z" fill="rgba(0,0,0,0.15)" />
      <rect x="18" y="12" width="4" height="22" fill="white" rx="1" />
      <rect x="9" y="20" width="22" height="4" fill="white" rx="1" />
      <circle cx="9" cy="12" r="1.8" fill="url(#gg)" />
      <circle cx="31" cy="12" r="1.8" fill="url(#gg)" />
      <circle cx="9" cy="34" r="1.8" fill="url(#gg)" />
      <circle cx="31" cy="34" r="1.8" fill="url(#gg)" />
      <circle cx="20" cy="8" r="1.5" fill="url(#gg)" />
      <path d="M20 1L1 7V27C1 37 11 43.5 20 46C29 43.5 39 37 39 27V7L20 1Z" fill="none" stroke="rgba(232,200,64,0.3)" strokeWidth="1" />
    </svg>
  )
}

function PosBadge({ pos }: { pos: Pos }) {
  return (
    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
      style={{ backgroundColor: POS_COLORS[pos] + '22', color: POS_COLORS[pos], border: `1px solid ${POS_COLORS[pos]}44` }}>
      {pos}
    </span>
  )
}

function TrendIcon({ trend }: { trend: 'up' | 'down' | 'stable' }) {
  if (trend === 'up') return <TrendingUp size={12} className="text-emerald-400" />
  if (trend === 'down') return <TrendingDown size={12} className="text-red-400" />
  return <Minus size={12} className="text-slate-500" />
}

function LiveBadge({ minute }: { minute?: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wider"
      style={{ backgroundColor: '#EF444418', border: '1px solid #EF444450', color: '#FF6060' }}>
      <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-live-pulse inline-block" />
      AO VIVO {minute && `${minute}'`}
    </span>
  )
}

function RarityBadge({ rarity }: { rarity: Rarity }) {
  const cfg = RARITY_CFG[rarity]
  return (
    <span className="text-[9px] font-bold tracking-widest px-2 py-0.5 rounded-full"
      style={{ background: cfg.bg, color: cfg.accent, border: `1px solid ${cfg.border}` }}>
      {cfg.label}
    </span>
  )
}

// ─── Player Card ──────────────────────────────────────────────────────────────

function PlayerCard({ player, onClick, rank, compact }: { player: Player; onClick?: () => void; rank?: number; compact?: boolean }) {
  const [hovered, setHovered] = useState(false)
  const cfg = RARITY_CFG[player.rarity]
  const w = compact ? 140 : 160

  return (
    <div
      role="button" tabIndex={0} onClick={onClick}
      onKeyDown={e => e.key === 'Enter' && onClick?.()}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`relative cursor-pointer overflow-hidden rounded-2xl select-none ${cfg.glow}-glow`}
      style={{
        background: cfg.bg, border: `1px solid ${hovered ? cfg.accent + '80' : cfg.border}`,
        transform: hovered ? 'translateY(-8px) scale(1.03)' : 'translateY(0) scale(1)',
        transition: 'all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
        width: w, flexShrink: 0,
        boxShadow: hovered ? `0 20px 40px rgba(0,0,0,0.4), 0 0 0 1px ${cfg.accent}30` : undefined,
      }}
    >
      {player.rarity === 'legendary' && <div className="card-shine absolute inset-0 z-10 pointer-events-none" />}

      {/* Top row */}
      <div className="flex items-start justify-between px-3 pt-3 pb-1">
        <div>
          <div className="font-display font-extrabold leading-none" style={{ fontSize: compact ? 24 : 28, color: cfg.accent }}>{fmtRating(player.rating)}</div>
          <PosBadge pos={player.pos} />
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-lg leading-none">{player.flag}</span>
          {rank && <span className="text-[10px] font-bold" style={{ color: cfg.accent + 'AA' }}>#{rank}</span>}
        </div>
      </div>

      {/* Photo area */}
      <div className="relative mx-2 rounded-xl overflow-hidden" style={{ height: compact ? 80 : 100, background: cfg.photoGrad }}>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-display font-black opacity-[0.08] select-none text-white" style={{ fontSize: compact ? 62 : 74, lineHeight: 1 }}>{player.num}</span>
        </div>
        {player.photo && (
          <img src={player.photo} alt={player.name}
            className="absolute inset-0 w-full h-full object-cover object-top select-none" draggable={false} />
        )}
        {player.rarity === 'legendary' && (
          <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(26,95,204,0.25) 0%, transparent 60%, rgba(196,151,42,0.2) 100%)' }} />
        )}
        <div className="absolute bottom-1.5 right-1.5">
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded backdrop-blur-sm" style={{ background: 'rgba(0,0,0,0.55)', color: cfg.accent }}>#{player.num}</span>
        </div>
        <div className="absolute inset-x-0 bottom-0 h-8" style={{ background: 'linear-gradient(0deg, rgba(0,0,0,0.65) 0%, transparent 100%)' }} />
      </div>

      {/* Name + trend */}
      <div className="px-3 pt-2 pb-1">
        <div className="font-display font-bold text-white truncate" style={{ fontSize: compact ? 10 : 12 }}>{player.short}</div>
        <div className="flex items-center gap-1 mt-0.5">
          <TrendIcon trend={player.trend} />
          <span className="text-[10px]" style={{ color: '#5070A0' }}>{fmtVotes(player.votes)}</span>
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center justify-between px-3 py-2 mx-2 mb-2 rounded-lg" style={{ background: 'rgba(0,0,0,0.38)' }}>
        {player.pos === 'GK' ? (
          <>
            <StatMini icon="🧤" value={player.cleanSheets ?? 0} label="CS" />
            <div className="w-px h-5 bg-white opacity-10" />
            <StatMini icon="🛡" value={player.saves ?? 0} label="DEF" />
          </>
        ) : (
          <>
            <StatMini icon="⚽" value={player.goals} label="GOL" />
            <div className="w-px h-5 bg-white opacity-10" />
            <StatMini icon="A" value={player.assists} label="ASS" />
          </>
        )}
        <div className="w-px h-5 bg-white opacity-10" />
        <StatMini icon="P" value={player.matches} label="JG" />
      </div>

      <div className="px-3 pb-3">
        <RarityBadge rarity={player.rarity} />
      </div>
    </div>
  )
}

function StatMini({ icon, value, label }: { icon: string; value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="font-bold" style={{ fontSize: 10 }}>{icon}</span>
      <span className="font-display font-bold text-white" style={{ fontSize: 11 }}>{value}</span>
      <span style={{ fontSize: 8, color: '#5070A0' }}>{label}</span>
    </div>
  )
}

// ─── Match Card ───────────────────────────────────────────────────────────────

function MatchCard({ match, onClick }: { match: Match; onClick?: () => void }) {
  const [hovered, setHovered] = useState(false)
  const cruzIsHome = isCruzeiro(match.home)
  const cruzScore = cruzIsHome ? match.homeScore : match.awayScore
  const oppScore = cruzIsHome ? match.awayScore : match.homeScore
  const won = match.status === 'finished' && cruzScore > oppScore
  const drew = match.status === 'finished' && cruzScore === oppScore
  const lost = match.status === 'finished' && cruzScore < oppScore
  const resultColor = won ? '#22C55E' : drew ? '#F59E0B' : lost ? '#EF4444' : '#6080A0'

  return (
    <div
      role="button" tabIndex={0} onClick={onClick}
      onKeyDown={e => e.key === 'Enter' && onClick?.()}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="cursor-pointer rounded-2xl transition-all duration-200"
      style={{
        background: hovered ? '#0D1C30' : '#0A1528',
        border: `1px solid ${hovered ? 'rgba(26,95,204,0.3)' : 'rgba(255,255,255,0.06)'}`,
        transform: hovered ? 'translateY(-2px)' : 'none',
      }}
    >
      <div className="px-4 py-3.5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-medium" style={{ color: '#5A7090' }}>{match.comp}</span>
          <div className="flex items-center gap-2">
            <span className="text-[11px]" style={{ color: '#3A4A60' }}>{match.round}</span>
            {match.status === 'live' && <LiveBadge minute={match.minute} />}
            {match.status === 'upcoming' && (
              <span className="text-[11px] px-2 py-0.5 rounded-full font-medium"
                style={{ background: 'rgba(0,48,135,0.25)', color: '#4A8EE8', border: '1px solid rgba(26,95,204,0.3)' }}>
                PRÓXIMA
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <TeamBlock name={match.home} isCruzeiro={isCruzeiro(match.home)} />
          <div className="flex flex-col items-center px-4">
            {match.status === 'upcoming' ? (
              <div className="flex flex-col items-center gap-1">
                <span className="font-display font-bold" style={{ fontSize: 22, color: '#4A8EE8' }}>vs</span>
                <span className="text-[11px]" style={{ color: '#3A4A60' }}>{match.date}</span>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <span className="font-display font-black" style={{ fontSize: 30, color: isCruzeiro(match.home) ? (won || drew ? 'white' : '#7090B0') : '#7090B0', lineHeight: 1 }}>{match.homeScore}</span>
                  <span className="font-display font-light" style={{ fontSize: 20, color: '#2A3A4A' }}>–</span>
                  <span className="font-display font-black" style={{ fontSize: 30, color: !isCruzeiro(match.home) ? (won || drew ? 'white' : '#7090B0') : '#7090B0', lineHeight: 1 }}>{match.awayScore}</span>
                </div>
                {match.status === 'finished' && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full mt-1"
                    style={{ background: resultColor + '18', color: resultColor, border: `1px solid ${resultColor}35` }}>
                    {won ? 'VITÓRIA' : drew ? 'EMPATE' : 'DERROTA'}
                  </span>
                )}
              </>
            )}
          </div>
          <TeamBlock name={match.away} isCruzeiro={isCruzeiro(match.away)} align="right" />
        </div>

        <div className="flex items-center gap-1.5 mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          <MapPin size={11} style={{ color: '#3A4A60' }} />
          <span style={{ fontSize: 11, color: '#3A4A60' }}>{match.venue}</span>
        </div>
      </div>
    </div>
  )
}

function TeamBlock({ name, isCruzeiro: isCruz, align = 'left' }: { name: string; isCruzeiro: boolean; align?: 'left' | 'right' }) {
  return (
    <div className={`flex flex-col gap-1.5 ${align === 'right' ? 'items-end' : 'items-start'}`} style={{ width: 120 }}>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: isCruz ? 'linear-gradient(135deg, #003087, #1A5FCC)' : '#101E30', border: '1px solid rgba(255,255,255,0.08)' }}>
        {isCruz ? <CruzeiroCrest size={24} /> : <span className="text-white font-bold text-sm">{name.slice(0, 1)}</span>}
      </div>
      <span className={`font-display font-semibold leading-tight ${align === 'right' ? 'text-right' : ''}`}
        style={{ fontSize: 13, color: isCruz ? 'white' : '#8098B0', maxWidth: 100 }}>
        {name}
      </span>
    </div>
  )
}

// ─── Competition Card ─────────────────────────────────────────────────────────

function CompetitionCard({ name, abbr, position, played, points, form, color, bg }: {
  name: string; abbr: string; position: number; played: number; points: number;
  form: ('W' | 'D' | 'L')[]; color: string; bg: string;
}) {
  const [hovered, setHovered] = useState(false)
  const formColors = { W: '#22C55E', D: '#F59E0B', L: '#EF4444' }

  return (
    <div
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      className="rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 flex-shrink-0"
      style={{
        background: hovered ? bg.replace('0.12', '0.18') : bg,
        border: `1px solid ${color}30`,
        transform: hovered ? 'translateY(-3px)' : 'none',
        boxShadow: hovered ? `0 12px 32px ${color}20` : 'none',
        width: 200,
      }}
    >
      <div className="p-4">
        {/* Competition header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center font-display font-black text-sm text-white"
            style={{ background: `linear-gradient(135deg, ${color}60, ${color}30)`, border: `1px solid ${color}40` }}>
            {abbr}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-display font-bold text-white truncate" style={{ fontSize: 12 }}>{name}</div>
            <div className="text-[10px] mt-0.5" style={{ color: '#5070A0' }}>Temporada 2024</div>
          </div>
        </div>

        {/* Position + Points */}
        <div className="flex items-end justify-between mb-3">
          <div>
            <div className="font-display font-black text-white" style={{ fontSize: 32, lineHeight: 1, color }}>
              {position}<span className="text-base" style={{ color: color + 'AA' }}>°</span>
            </div>
            <div className="text-[10px] mt-0.5" style={{ color: '#5070A0' }}>Classificação</div>
          </div>
          <div className="text-right">
            <div className="font-display font-black text-white" style={{ fontSize: 20, lineHeight: 1 }}>{points}</div>
            <div className="text-[10px]" style={{ color: '#5070A0' }}>pts · {played}jg</div>
          </div>
        </div>

        {/* Form */}
        <div>
          <div className="text-[9px] font-semibold tracking-widest uppercase mb-1.5" style={{ color: '#3A5070' }}>Últimos 5</div>
          <div className="flex gap-1">
            {form.map((r, i) => (
              <div key={i} className="w-5 h-5 rounded flex items-center justify-center font-display font-black"
                style={{ background: formColors[r] + '25', color: formColors[r], fontSize: 9, border: `1px solid ${formColors[r]}35` }}>
                {r}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { id: 'home' as Page, icon: Home, label: 'Início' },
  { id: 'rankings' as Page, icon: Trophy, label: 'Rankings' },
  { id: 'players' as Page, icon: Users, label: 'Jogadores' },
  { id: 'matches' as Page, icon: Calendar, label: 'Partidas' },
  { id: 'rate' as Page, icon: Star, label: 'Votar' },
]

function Sidebar({ page, setPage }: { page: Page; setPage: (p: Page) => void }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <aside
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      className="fixed left-0 top-0 h-full z-50 flex flex-col overflow-hidden"
      style={{ width: expanded ? 204 : 60, background: '#030910', borderRight: '1px solid rgba(255,255,255,0.05)', transition: 'width 0.3s cubic-bezier(0.4,0,0.2,1)' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-3.5 py-5" style={{ minHeight: 72, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="flex-shrink-0 flex items-center justify-center" style={{ width: 32 }}>
          <CruzeiroCrest size={28} />
        </div>
        <div className="overflow-hidden" style={{ opacity: expanded ? 1 : 0, width: expanded ? 140 : 0, transition: 'all 0.25s ease' }}>
          <JeanScoreLogo width={130} showStars={false} />
        </div>
      </div>

      <nav className="flex-1 py-4 flex flex-col gap-1">
        {NAV_ITEMS.map(({ id, icon: Icon, label }) => {
          const active = page === id || (id === 'home' && page === 'match-detail')
          return (
            <button key={id} onClick={() => setPage(id)}
              className="flex items-center gap-3 mx-2 px-2.5 py-2.5 rounded-xl transition-all duration-150 text-left"
              style={{
                background: active ? 'linear-gradient(135deg, rgba(0,48,135,0.7), rgba(26,95,204,0.35))' : 'transparent',
                borderLeft: active ? '2px solid #1A5FCC' : '2px solid transparent',
              }}
            >
              <Icon size={18} style={{ color: active ? '#5A9FEC' : '#3A5070', flexShrink: 0 }} />
              <span className="text-sm font-medium whitespace-nowrap overflow-hidden"
                style={{ opacity: expanded ? 1 : 0, width: expanded ? 'auto' : 0, color: active ? '#E0ECFF' : '#4A6080', transition: 'all 0.2s ease' }}>
                {label}
              </span>
            </button>
          )
        })}
      </nav>

      <div className="py-4" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <button onClick={() => setPage('admin')}
          className="flex items-center gap-3 mx-2 px-2.5 py-2.5 rounded-xl w-[calc(100%-16px)] transition-all duration-150"
          style={{ background: page === 'admin' ? 'rgba(196,151,42,0.12)' : 'transparent' }}>
          <Settings size={16} style={{ flexShrink: 0, color: page === 'admin' ? '#C4972A' : '#2A3A50' }} />
          <span className="text-sm font-medium whitespace-nowrap overflow-hidden"
            style={{ opacity: expanded ? 1 : 0, width: expanded ? 'auto' : 0, color: page === 'admin' ? '#C4972A' : '#3A5070', transition: 'all 0.2s ease' }}>
            Admin
          </span>
        </button>
      </div>
    </aside>
  )
}

// ─── Top Bar ──────────────────────────────────────────────────────────────────

function TopBar({ title }: { title: string }) {
  return (
    <header className="sticky top-0 z-40 flex items-center justify-between px-6 py-3.5"
      style={{ background: 'rgba(3,9,16,0.9)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <h1 className="font-display font-bold text-white" style={{ fontSize: 17 }}>{title}</h1>
      <div className="flex items-center gap-2.5">
        <button className="w-8 h-8 flex items-center justify-center rounded-xl"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <Search size={14} style={{ color: '#5070A0' }} />
        </button>
        <button className="w-8 h-8 flex items-center justify-center rounded-xl relative"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <Bell size={14} style={{ color: '#5070A0' }} />
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500 border border-[#030910]" />
        </button>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center font-display font-bold text-white text-xs"
          style={{ background: 'linear-gradient(135deg, #003087, #1A5FCC)' }}>R</div>
      </div>
    </header>
  )
}

// ─── Home Page ────────────────────────────────────────────────────────────────

function HomePage({ setPage, setSelectedPlayer, setSelectedMatch }: {
  setPage: (p: Page) => void
  setSelectedPlayer: (p: Player) => void
  setSelectedMatch: (m: Match) => void
}) {
  const { players: PLAYERS, matches: MATCHES, standings, competitions } = useData()
  const topPlayers = PLAYERS.slice(0, 5)
  // Featured match for the hero: the next upcoming fixture, else the most recent result.
  const featured = MATCHES.find(m => m.status === 'upcoming') ?? MATCHES.find(m => m.status === 'finished') ?? MATCHES[0] ?? MOCK_MATCHES[0]
  const cruzHome = isCruzeiro(featured.home)
  const opponent = cruzHome ? featured.away : featured.home
  const cruzScore = cruzHome ? featured.homeScore : featured.awayScore
  const oppScore = cruzHome ? featured.awayScore : featured.homeScore
  const featuredFinished = featured.status === 'finished'

  // Real season summary computed from finished fixtures.
  const finishedMatches = MATCHES.filter(m => m.status === 'finished')
  let wins = 0, draws = 0, goalsFor = 0
  for (const m of finishedMatches) {
    const home = isCruzeiro(m.home)
    const cs = home ? m.homeScore : m.awayScore
    const os = home ? m.awayScore : m.homeScore
    goalsFor += cs
    if (cs > os) wins++
    else if (cs === os) draws++
  }
  const points = wins * 3 + draws
  const efficiency = finishedMatches.length > 0 ? Math.round((points / (finishedMatches.length * 3)) * 100) : 0

  const nextMatch = MATCHES.find(m => m.status === 'upcoming') ?? null
  const nextOpp = nextMatch ? (isCruzeiro(nextMatch.home) ? nextMatch.away : nextMatch.home) : ''

  const [activeForm, setActiveForm] = useState<'W' | 'D' | 'L' | null>(null)

  return (
    <div className="pb-16">
      {/* ─ Hero ─ */}
      <div className="relative overflow-hidden" style={{ minHeight: 500 }}>
        {/* Background layers */}
        <img
          src={fotoFundoInicio}
          alt="Fundo Início"
          className="absolute inset-0 w-full h-full object-cover"
          style={{ filter: 'brightness(0.55) saturate(0.85)' }}
        />
        {/* Blue cast from Cruzeiro side */}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(105deg, rgba(0,40,100,0.75) 0%, rgba(0,15,40,0.5) 45%, rgba(3,9,16,0.2) 100%)' }} />
        {/* Bottom fade */}
        <div className="absolute inset-x-0 bottom-0" style={{ height: 180, background: 'linear-gradient(0deg, #050D1B 0%, rgba(5,13,27,0.8) 50%, transparent 100%)' }} />
        {/* Top fade */}
        <div className="absolute inset-x-0 top-0 h-24" style={{ background: 'linear-gradient(180deg, rgba(3,9,16,0.5) 0%, transparent 100%)' }} />
        {/* Decorative diagonal accent */}
        <div className="absolute" style={{ top: '20%', right: '10%', width: 2, height: '60%', background: 'linear-gradient(180deg, transparent, rgba(196,151,42,0.15), transparent)', transform: 'rotate(12deg)' }} />

        <div className="relative z-10 px-6 pt-10 pb-14">
          {/* Competition tag */}
          <div className="flex items-center gap-2 mb-8">
            <div className="w-5 h-5 flex-shrink-0"><CruzeiroCrest size={20} /></div>
            <span className="font-display font-semibold tracking-widest uppercase"
              style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.15em' }}>
              {featured.comp} · {featured.date}
            </span>
          </div>

          {/* Main score layout */}
          <div className="flex items-center gap-0">
            {/* Cruzeiro */}
            <div className="flex flex-col items-center gap-4" style={{ minWidth: 160 }}>
              <div className="w-20 h-20 rounded-3xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, rgba(0,48,135,0.9), rgba(26,95,204,0.6))', border: '1px solid rgba(26,95,204,0.5)', boxShadow: '0 0 30px rgba(26,95,204,0.3)' }}>
                <CruzeiroCrest size={44} />
              </div>
              <span className="font-display font-black text-white" style={{ fontSize: 18 }}>Cruzeiro</span>
            </div>

            {/* Score center */}
            <div className="flex-1 flex flex-col items-center gap-3">
              {featuredFinished ? (
                <span className="text-[11px] font-bold tracking-wider px-3 py-1 rounded-full"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.6)' }}>
                  ENCERRADO
                </span>
              ) : (
                <span className="text-[11px] font-bold tracking-wider px-3 py-1 rounded-full"
                  style={{ background: 'rgba(26,95,204,0.2)', border: '1px solid rgba(26,95,204,0.4)', color: '#4A8EE8' }}>
                  PRÓXIMO JOGO
                </span>
              )}
              {featuredFinished ? (
                <div className="flex items-center gap-4">
                  <span className="font-display font-black text-white" style={{ fontSize: 80, lineHeight: 1, textShadow: '0 0 60px rgba(255,255,255,0.15)' }}>{cruzScore}</span>
                  <span className="font-display font-thin" style={{ fontSize: 48, color: 'rgba(255,255,255,0.2)' }}>:</span>
                  <span className="font-display font-black" style={{ fontSize: 80, lineHeight: 1, color: 'rgba(255,255,255,0.45)' }}>{oppScore}</span>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <span className="font-display font-black" style={{ fontSize: 56, lineHeight: 1, color: 'rgba(255,255,255,0.9)' }}>VS</span>
                </div>
              )}
              {featured.venue && (
                <div className="flex items-center gap-1.5">
                  <MapPin size={12} style={{ color: 'rgba(255,255,255,0.35)' }} />
                  <span className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>{featured.venue}</span>
                </div>
              )}
              <div className="flex gap-2 mt-1">
                <button
                  onClick={() => { setSelectedMatch(featured); setPage('match-detail') }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200"
                  style={{ background: 'linear-gradient(135deg, #003087, #1A5FCC)', color: 'white', boxShadow: '0 4px 16px rgba(26,95,204,0.4)' }}>
                  Ver Partida
                </button>
                <button
                  onClick={() => setPage('rate')}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200"
                  style={{ background: 'rgba(196,151,42,0.18)', color: '#E8C840', border: '1px solid rgba(196,151,42,0.3)' }}>
                  <Star size={13} /> Avaliar
                </button>
              </div>
            </div>

            {/* Opponent */}
            <div className="flex flex-col items-center gap-4" style={{ minWidth: 160 }}>
              <div className="w-20 h-20 rounded-3xl flex items-center justify-center"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <span className="font-black text-white/70 text-2xl">{opponent.slice(0, 3).toUpperCase()}</span>
              </div>
              <span className="font-display font-black text-center" style={{ fontSize: 18, color: 'rgba(255,255,255,0.6)', maxWidth: 150 }}>{opponent}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ─ Content ─ */}
      <div className="px-6 space-y-10">
        {/* Season stats row */}
        <div className="grid grid-cols-4 gap-3 -mt-4">
          {[
            { icon: Trophy, label: `${finishedMatches.length}`, sub: 'Jogos disputados', color: '#C4972A' },
            { icon: Flame, label: `${wins}`, sub: 'Vitórias', color: '#EF4444' },
            { icon: Target, label: `${goalsFor}`, sub: 'Gols marcados', color: '#22C55E' },
            { icon: Activity, label: `${efficiency}%`, sub: 'Aproveitamento', color: '#4A8EE8' },
          ].map(({ icon: Icon, label, sub, color }) => (
            <div key={sub} className="rounded-2xl p-4 flex flex-col gap-2"
              style={{ background: 'rgba(10,21,40,0.95)', border: '1px solid rgba(255,255,255,0.06)', backdropFilter: 'blur(10px)' }}>
              <Icon size={15} style={{ color }} />
              <div className="font-display font-black text-white" style={{ fontSize: 24 }}>{label}</div>
              <div className="text-[11px]" style={{ color: '#5070A0' }}>{sub}</div>
            </div>
          ))}
        </div>

        {/* Top players */}
        <section>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-display font-black text-white" style={{ fontSize: 20 }}>Top Jogadores</h2>
              <p className="text-xs mt-0.5" style={{ color: '#5070A0' }}>Melhores avaliados · Temporada 2024</p>
            </div>
            <button onClick={() => setPage('rankings')}
              className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg"
              style={{ background: 'rgba(26,95,204,0.15)', color: '#4A8EE8', border: '1px solid rgba(26,95,204,0.25)' }}>
              Ver ranking <ChevronRight size={12} />
            </button>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {topPlayers.map((p, i) => (
              <PlayerCard key={p.id} player={p} rank={i + 1}
                onClick={() => { setSelectedPlayer(p); setPage('profile') }} />
            ))}
          </div>
        </section>

        {/* Competitions */}
        {(competitions.length > 0 || standings.length > 0) && (
          <section>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="font-display font-black text-white" style={{ fontSize: 20 }}>Competições</h2>
                <p className="text-xs mt-0.5" style={{ color: '#5070A0' }}>Classificação e status atual do Cruzeiro</p>
              </div>
            </div>

            {/* Cup competition status cards */}
            {competitions.length > 0 && (
              <div className="flex gap-4 overflow-x-auto pb-2 mb-6">
                {competitions.map(c => (
                  <div key={c.id} className="rounded-2xl p-4 flex-shrink-0" style={{ width: 230, background: 'linear-gradient(135deg, rgba(26,95,204,0.12), rgba(3,9,16,0.9))', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div className="font-display font-bold text-white mb-3" style={{ fontSize: 13 }}>{c.competition}</div>
                    {[
                      { l: 'Status', v: c.status },
                      { l: 'Fase', v: c.stage },
                      { l: 'Próximo jogo', v: c.next_match },
                      { l: 'Data', v: c.next_date },
                    ].map(({ l, v }) => (
                      <div key={l} className="flex items-center justify-between gap-2 py-1">
                        <span className="text-[11px]" style={{ color: '#5070A0' }}>{l}</span>
                        <span className="text-[11px] font-semibold text-right text-white" style={{ maxWidth: 130 }}>{v ?? '—'}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}

            {/* Brasileirão full standings table */}
            {standings.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-display font-bold text-white" style={{ fontSize: 15 }}>Classificação — Brasileirão</h3>
                </div>
                <div className="rounded-2xl overflow-x-auto" style={{ background: '#0A1528', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ minWidth: 520 }}>
                    {/* Header */}
                    <div className="grid items-center px-4 py-2.5" style={{ gridTemplateColumns: '28px minmax(120px,1fr) repeat(8, 34px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      <span className="text-[10px] font-bold uppercase" style={{ color: '#3A5070' }}>#</span>
                      <span className="text-[10px] font-bold uppercase" style={{ color: '#3A5070' }}>Time</span>
                      {['J', 'V', 'E', 'D', 'GP', 'GC', 'SG', 'Pts'].map(h => (
                        <span key={h} className="text-[10px] font-bold uppercase text-center" style={{ color: h === 'Pts' ? '#4A8EE8' : '#3A5070' }}>{h}</span>
                      ))}
                    </div>
                    {standings.map((row, i) => (
                      <div key={row.position}
                        className="grid items-center px-4 py-2.5"
                        style={{
                          gridTemplateColumns: '28px minmax(120px,1fr) repeat(8, 34px)',
                          background: row.is_cruzeiro ? 'rgba(26,95,204,0.12)' : 'transparent',
                          borderBottom: i < standings.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                          borderLeft: row.is_cruzeiro ? '2px solid #1A5FCC' : '2px solid transparent',
                        }}
                      >
                        <span className="font-display font-black" style={{ fontSize: 12, color: row.is_cruzeiro ? '#4A8EE8' : '#3A4A5A' }}>{row.position}</span>
                        <span className="font-display font-semibold truncate" style={{ fontSize: 13, color: row.is_cruzeiro ? 'white' : '#8098B0' }}>{row.team}</span>
                        {[row.played, row.wins, row.draws, row.losses, row.goals_for, row.goals_against, row.goal_diff, row.points].map((val, k) => (
                          <span key={k} className="font-display text-center" style={{ fontSize: 12, fontWeight: k === 7 ? 900 : 500, color: k === 7 ? (row.is_cruzeiro ? '#4A8EE8' : 'white') : '#7090B0' }}>{val}</span>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {/* Two-column: Recent results + Upcoming */}
        <div className="grid grid-cols-2 gap-6">
          {/* Recent results */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-bold text-white" style={{ fontSize: 16 }}>Últimas Partidas</h2>
              <button onClick={() => setPage('matches')} className="text-xs font-semibold" style={{ color: '#4A8EE8' }}>Ver todas</button>
            </div>
            <div className="space-y-3">
              {MATCHES.filter(m => m.status !== 'upcoming').slice(0, 3).map(m => (
                <MatchCard key={m.id} match={m} onClick={() => { setSelectedMatch(m); setPage('match-detail') }} />
              ))}
            </div>
          </section>

          {/* Próxima + standings */}
          <section className="space-y-4">
            {/* Next match */}
            <div>
              <h2 className="font-display font-bold text-white mb-4" style={{ fontSize: 16 }}>Próxima Partida</h2>
              <div className="rounded-2xl overflow-hidden"
                style={{ background: 'linear-gradient(135deg, #0A1830, #0F2248)', border: '1px solid rgba(26,95,204,0.2)' }}>
                <div className="px-5 py-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ background: 'linear-gradient(135deg, #003087, #1A5FCC)' }}>
                      <CruzeiroCrest size={22} />
                    </div>
                    <div className="font-display font-black text-white" style={{ fontSize: 15 }}>Cruzeiro</div>
                    <div className="flex flex-col items-center flex-1">
                      <span className="font-display font-black" style={{ fontSize: 20, color: '#4A8EE8' }}>VS</span>
                      <span className="text-[10px] mt-1" style={{ color: '#3A5070' }}>{nextMatch?.date ?? ''}</span>
                    </div>
                    <div className="font-display font-black text-right" style={{ fontSize: 15, color: '#8098B0', maxWidth: 90 }}>{nextOpp}</div>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ background: 'rgba(255,255,255,0.06)' }}>
                      <span className="font-bold text-white/60 text-xs">{nextOpp.slice(0, 3).toUpperCase()}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <MapPin size={11} style={{ color: '#3A5070' }} />
                    <span className="text-[11px]" style={{ color: '#3A5070' }}>{nextMatch ? `${nextMatch.venue} · ${nextMatch.comp}` : 'Sem jogos futuros'}</span>
                  </div>
                </div>
              </div>
            </div>

          </section>
        </div>

        {/* Community feed */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-display font-black text-white" style={{ fontSize: 20 }}>Avaliações Recentes</h2>
              <p className="text-xs mt-0.5" style={{ color: '#5070A0' }}>O que a torcida está dizendo agora</p>
            </div>
          </div>
          <div className="rounded-2xl px-6 py-10 flex flex-col items-center text-center gap-2"
            style={{ background: '#0A1528', border: '1px solid rgba(255,255,255,0.05)' }}>
            <Vote size={26} style={{ color: '#2A3A50' }} />
            <p className="font-display font-bold text-white" style={{ fontSize: 15 }}>Ainda não há avaliações</p>
            <p className="text-xs" style={{ color: '#5070A0', maxWidth: 340 }}>Seja o primeiro a avaliar os jogadores. As notas da torcida vão aparecer aqui.</p>
            <button onClick={() => setPage('rate')}
              className="mt-2 flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold"
              style={{ background: 'linear-gradient(135deg, #003087, #1A5FCC)', color: 'white' }}>
              <Star size={13} /> Avaliar agora
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}

// ─── Rankings Page ────────────────────────────────────────────────────────────

function RankingsPage({ setPage, setSelectedPlayer }: { setPage: (p: Page) => void; setSelectedPlayer: (p: Player) => void }) {
  const { players: PLAYERS } = useData()
  const [filter, setFilter] = useState<'all' | 'GK' | 'DEF' | 'MID' | 'ATK'>('all')
  const [sortBy, setSortBy] = useState<'rating' | 'votes'>('rating')

  const filtered = PLAYERS.filter(p => {
    if (filter === 'GK') return p.pos === 'GK'
    if (filter === 'DEF') return ['CB', 'LB', 'RB'].includes(p.pos)
    if (filter === 'MID') return ['CDM', 'CM', 'CAM'].includes(p.pos)
    if (filter === 'ATK') return ['LW', 'RW', 'ST'].includes(p.pos)
    return true
  }).sort((a, b) => sortBy === 'rating' ? b.rating - a.rating : b.votes - a.votes)

  const podium = filtered.slice(0, 3)
  const rest = filtered.slice(3)

  return (
    <div className="px-6 pb-12">
      <div className="pt-8 pb-8">
        <div className="flex items-center gap-2 mb-3">
          <Trophy size={16} style={{ color: '#C4972A' }} />
          <span className="text-xs font-bold tracking-widest uppercase" style={{ color: '#C4972A' }}>Temporada 2024</span>
        </div>
        <h2 className="font-display font-black text-white" style={{ fontSize: 36, lineHeight: 1.05 }}>
          Ranking de<br />
          <span style={{ background: 'linear-gradient(90deg, #C4972A, #E8C840)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Jogadores
          </span>
        </h2>
      </div>

      <div className="flex items-center justify-between mb-8">
        <div className="flex gap-2">
          {(['all', 'GK', 'DEF', 'MID', 'ATK'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150"
              style={{ background: filter === f ? '#003087' : 'rgba(255,255,255,0.05)', color: filter === f ? 'white' : '#5070A0', border: filter === f ? '1px solid #1A5FCC' : '1px solid transparent' }}>
              {f === 'all' ? 'Todos' : f}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          {(['rating', 'votes'] as const).map(s => (
            <button key={s} onClick={() => setSortBy(s)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-150"
              style={{ background: sortBy === s ? 'rgba(196,151,42,0.18)' : 'rgba(255,255,255,0.04)', color: sortBy === s ? '#C4972A' : '#5070A0', border: sortBy === s ? '1px solid rgba(196,151,42,0.3)' : '1px solid transparent' }}>
              {s === 'rating' ? 'Nota' : 'Votos'}
            </button>
          ))}
        </div>
      </div>

      {podium.length >= 3 && (
        <div className="mb-12">
          <div className="flex items-end justify-center gap-6">
            <PodiumCard player={podium[1]} rank={2} onClick={() => { setSelectedPlayer(podium[1]); setPage('profile') }} />
            <PodiumCard player={podium[0]} rank={1} onClick={() => { setSelectedPlayer(podium[0]); setPage('profile') }} elevated />
            <PodiumCard player={podium[2]} rank={3} onClick={() => { setSelectedPlayer(podium[2]); setPage('profile') }} />
          </div>
        </div>
      )}

      <div className="space-y-2">
        <div className="text-xs font-bold tracking-widest uppercase px-4 mb-4" style={{ color: '#2A3A50' }}>Classificação Geral</div>
        {rest.map((player, i) => (
          <RankingRow key={player.id} player={player} rank={podium.length + i + 1}
            onClick={() => { setSelectedPlayer(player); setPage('profile') }} />
        ))}
      </div>
    </div>
  )
}

function PodiumCard({ player, rank, onClick, elevated }: { player: Player; rank: 1 | 2 | 3; onClick: () => void; elevated?: boolean }) {
  const [hovered, setHovered] = useState(false)
  const medals = {
    1: { color: '#C4972A', glow: 'rgba(196,151,42,0.45)', emoji: '🥇', height: 88 },
    2: { color: '#9AAAB8', glow: 'rgba(154,170,184,0.3)', emoji: '🥈', height: 60 },
    3: { color: '#C47848', glow: 'rgba(196,120,72,0.3)', emoji: '🥉', height: 52 },
  }
  const m = medals[rank]
  const cfg = RARITY_CFG[player.rarity]

  return (
    <div className="flex flex-col items-center gap-3 cursor-pointer"
      onClick={onClick} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{ transform: elevated ? 'translateY(-24px)' : 'none' }}>
      {rank === 1 && <Crown size={22} style={{ color: '#C4972A', filter: 'drop-shadow(0 0 10px rgba(196,151,42,0.6))' }} />}
      <span style={{ fontSize: 26 }}>{m.emoji}</span>
      <div className="relative overflow-hidden rounded-2xl transition-all duration-300"
        style={{
          background: cfg.bg, border: `1px solid ${hovered ? m.color + '60' : cfg.border}`,
          boxShadow: hovered ? `0 12px 40px ${m.glow}, 0 0 0 1px ${m.color}25` : `0 4px 16px ${m.glow}`,
          transform: hovered ? 'scale(1.06)' : 'scale(1)',
          width: elevated ? 148 : 126, padding: '12px 10px',
        }}>
        <div className="relative rounded-xl overflow-hidden mb-2" style={{ height: elevated ? 96 : 76, background: cfg.photoGrad }}>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-display font-black opacity-[0.08] text-white select-none" style={{ fontSize: elevated ? 68 : 56 }}>{player.num}</span>
          </div>
          {player.photo && (
            <img src={player.photo} alt={player.name}
              className="absolute inset-0 w-full h-full object-cover object-top select-none" draggable={false} />
          )}
        </div>
        <div className="absolute top-2 left-2 font-display font-black" style={{ fontSize: 12, color: m.color }}>#{rank}</div>
        <div className="font-display font-extrabold text-white truncate" style={{ fontSize: elevated ? 11 : 10 }}>{player.short}</div>
        <div className="flex items-center justify-between mt-1.5">
          <PosBadge pos={player.pos} />
          <span className="font-display font-black" style={{ fontSize: elevated ? 18 : 15, color: m.color }}>{fmtRating(player.rating)}</span>
        </div>
        <div className="mt-1 text-center" style={{ fontSize: 10, color: '#4A6080' }}>{fmtVotes(player.votes)} votos</div>
      </div>
      <div className="rounded-xl flex items-center justify-center font-display font-black"
        style={{
          background: `linear-gradient(180deg, ${m.color}25, ${m.color}08)`,
          border: `1px solid ${m.color}25`,
          width: elevated ? 148 : 126, height: m.height,
          fontSize: 32, color: m.color,
          boxShadow: `0 4px 20px ${m.glow}`,
        }}>
        {rank}
      </div>
    </div>
  )
}

function RankingRow({ player, rank, onClick }: { player: Player; rank: number; onClick: () => void }) {
  const [hovered, setHovered] = useState(false)
  const cfg = RARITY_CFG[player.rarity]
  return (
    <div
      role="button" tabIndex={0} onClick={onClick} onKeyDown={e => e.key === 'Enter' && onClick()}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      className="flex items-center gap-4 px-4 py-3.5 rounded-2xl cursor-pointer transition-all duration-150"
      style={{ background: hovered ? '#0D1C30' : '#0A1528', border: `1px solid ${hovered ? 'rgba(26,95,204,0.2)' : 'rgba(255,255,255,0.05)'}` }}
    >
      <span className="font-display font-black w-6 text-center" style={{ fontSize: 15, color: '#2A3A50' }}>#{rank}</span>
      <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0" style={{ background: cfg.photoGrad }}>
        {player.photo
          ? <img src={player.photo} alt={player.name} className="w-full h-full object-cover object-top select-none" draggable={false} />
          : <div className="w-full h-full flex items-center justify-center">
              <span className="font-display font-black opacity-25 text-white" style={{ fontSize: 20 }}>{player.num}</span>
            </div>}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-display font-bold text-white" style={{ fontSize: 14 }}>{player.name}</span>
          <PosBadge pos={player.pos} />
          <TrendIcon trend={player.trend} />
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          <span className="text-xs" style={{ color: '#5070A0' }}>{fmtVotes(player.votes)} votos</span>
          <span className="text-xs" style={{ color: '#3A5070' }}>{player.matches} partidas</span>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right">
          <div className="font-display font-black" style={{ fontSize: 22, color: cfg.accent }}>{fmtRating(player.rating)}</div>
          <RarityBadge rarity={player.rarity} />
        </div>
        <ChevronRight size={14} style={{ color: '#2A3A50' }} />
      </div>
    </div>
  )
}

// ─── Players Page ─────────────────────────────────────────────────────────────

function PlayersPage({ setPage, setSelectedPlayer }: { setPage: (p: Page) => void; setSelectedPlayer: (p: Player) => void }) {
  const { players: PLAYERS } = useData()
  const [search, setSearch] = useState('')
  const [rarityFilter, setRarityFilter] = useState<Rarity | 'all'>('all')

  const filtered = PLAYERS.filter(p => {
    const ms = p.name.toLowerCase().includes(search.toLowerCase()) || p.pos.toLowerCase().includes(search.toLowerCase())
    const mr = rarityFilter === 'all' || p.rarity === rarityFilter
    return ms && mr
  })

  return (
    <div className="px-6 pb-12">
      <div className="pt-8 pb-6">
        <h2 className="font-display font-black text-white mb-1" style={{ fontSize: 32 }}>
          Elenco <span style={{ background: 'linear-gradient(90deg, #4A8EE8, #1A5FCC)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>2024</span>
        </h2>
        <p className="text-sm" style={{ color: '#5070A0' }}>{PLAYERS.length} jogadores · Todos avaliados</p>
      </div>

      <div className="relative mb-4">
        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: '#3A5070' }} />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar jogador ou posição..."
          className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none"
          style={{ background: '#0A1528', border: '1px solid rgba(255,255,255,0.07)', color: 'white', fontFamily: 'Inter, sans-serif' }} />
      </div>

      <div className="flex gap-2 mb-8 overflow-x-auto pb-1">
        {(['all', 'legendary', 'gold', 'silver', 'bronze'] as const).map(r => {
          const cfg = r !== 'all' ? RARITY_CFG[r] : null
          return (
            <button key={r} onClick={() => setRarityFilter(r)}
              className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-150"
              style={{
                background: rarityFilter === r ? (cfg ? cfg.bg : '#003087') : 'rgba(255,255,255,0.04)',
                color: rarityFilter === r ? (cfg ? cfg.accent : 'white') : '#5070A0',
                border: rarityFilter === r ? `1px solid ${cfg ? cfg.border : '#1A5FCC'}` : '1px solid transparent',
              }}>
              {r === 'all' ? 'Todos' : RARITY_CFG[r].label}
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap gap-4">
        {filtered.map((p, i) => (
          <PlayerCard key={p.id} player={p} rank={i + 1}
            onClick={() => { setSelectedPlayer(p); setPage('profile') }} />
        ))}
      </div>
    </div>
  )
}

// ─── Matches Page ─────────────────────────────────────────────────────────────

function MatchesPage({ setPage, setSelectedMatch }: { setPage: (p: Page) => void; setSelectedMatch: (m: Match) => void }) {
  const { matches: MATCHES } = useData()
  const [tab, setTab] = useState<'all' | 'finished' | 'upcoming'>('all')
  const [comp, setComp] = useState<string>('all')
  const competitions = Array.from(new Set(MATCHES.map(m => m.comp)))
  const filtered = MATCHES.filter(m =>
    (tab === 'all' || m.status === tab) && (comp === 'all' || m.comp === comp)
  )
  return (
    <div className="px-6 pb-12">
      <div className="pt-8 pb-6">
        <h2 className="font-display font-black text-white mb-1" style={{ fontSize: 32 }}>Partidas</h2>
      </div>
      {/* Status filter */}
      <div className="flex gap-2 mb-3">
        {(['all', 'finished', 'upcoming'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-150 flex items-center gap-1.5"
            style={{ background: tab === t ? '#003087' : 'rgba(255,255,255,0.04)', color: tab === t ? 'white' : '#5070A0', border: tab === t ? '1px solid #1A5FCC' : '1px solid transparent' }}>
            {{ all: 'Todas', finished: 'Encerradas', upcoming: 'Próximas' }[t]}
          </button>
        ))}
      </div>
      {/* Competition filter */}
      <div className="flex gap-2 mb-7 flex-wrap">
        {['all', ...competitions].map(c => (
          <button key={c} onClick={() => setComp(c)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150"
            style={{ background: comp === c ? 'rgba(26,95,204,0.18)' : 'rgba(255,255,255,0.04)', color: comp === c ? '#4A8EE8' : '#5070A0', border: comp === c ? '1px solid rgba(26,95,204,0.4)' : '1px solid rgba(255,255,255,0.05)' }}>
            {c === 'all' ? 'Todas as competições' : c}
          </button>
        ))}
      </div>
      <div className="space-y-3">
        {filtered.map(m => (
          <MatchCard key={m.id} match={m} onClick={() => { setSelectedMatch(m); setPage('match-detail') }} />
        ))}
      </div>
    </div>
  )
}

// ─── Player Profile Page ──────────────────────────────────────────────────────

function PlayerProfilePage({ player, onBack }: { player: Player; onBack: () => void }) {
  const cfg = RARITY_CFG[player.rarity]
  const [activeTab, setActiveTab] = useState<'stats' | 'history' | 'info'>('stats')

  const attrs = player.pos === 'GK'
    ? [{ label: 'Reflexos', v: 91 }, { label: 'Posicionamento', v: 87 }, { label: 'Saída', v: 78 }, { label: 'Comando', v: 85 }, { label: 'Distribuição', v: 72 }]
    : player.pos === 'ST'
      ? [{ label: 'Finalização', v: 84 }, { label: 'Velocidade', v: 78 }, { label: 'Cabeceio', v: 72 }, { label: 'Drible', v: 76 }, { label: 'Posicionamento', v: 82 }]
      : [{ label: 'Passe', v: 88 }, { label: 'Visão', v: 92 }, { label: 'Drible', v: 85 }, { label: 'Posicionamento', v: 83 }, { label: 'Finalização', v: 74 }]

  const keyStats = player.pos === 'GK'
    ? [{ label: 'Defesas', value: player.saves ?? 89, icon: '🧤' }, { label: 'Clean Sheets', value: player.cleanSheets ?? 14, icon: '🛡' }, { label: 'Partidas', value: player.matches, icon: '📅' }]
    : [{ label: 'Gols', value: player.goals, icon: '⚽' }, { label: 'Assistências', value: player.assists, icon: 'A' }, { label: 'Partidas', value: player.matches, icon: '📅' }]

  return (
    <div className="pb-12">
      {/* Hero */}
      <div className="relative overflow-hidden" style={{ minHeight: 320 }}>
        <div className="absolute inset-0" style={{ background: cfg.bg, opacity: 0.7 }} />
        <img src="https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=1200&h=500&fit=crop&auto=format"
          alt="Stadium" className="absolute inset-0 w-full h-full object-cover"
          style={{ filter: 'brightness(0.15) saturate(0.5)', mixBlendMode: 'luminosity' }} />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, transparent 0%, #050D1B 100%)' }} />
        {cfg.glow === 'legendary' && (
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: `radial-gradient(ellipse at 30% 50%, ${cfg.accent}15 0%, transparent 65%)` }} />
        )}

        <div className="relative z-10 px-6 pt-6 pb-10">
          <button onClick={onBack} className="flex items-center gap-2 text-sm mb-8" style={{ color: '#5070A0' }}>
            <ArrowLeft size={15} /> Voltar
          </button>

          <div className="flex items-end gap-8">
            {/* Card */}
            <div className="flex-shrink-0">
              <PlayerCard player={player} />
            </div>

            {/* Info panel */}
            <div className="flex-1 pb-2">
              <RarityBadge rarity={player.rarity} />
              <h1 className="font-display font-black text-white mt-2" style={{ fontSize: 36, lineHeight: 1.05, letterSpacing: '-0.02em' }}>{player.name}</h1>
              <div className="flex items-center gap-3 mt-2.5">
                <PosBadge pos={player.pos} />
                <span className="text-sm" style={{ color: '#5070A0' }}>{player.nat}</span>
                {player.age > 0 && <span className="text-sm" style={{ color: '#5070A0' }}>{player.age} anos</span>}
                <span className="text-sm" style={{ color: '#5070A0' }}>#{player.num}</span>
              </div>

              {/* Rating + rank */}
              <div className="flex items-end gap-6 mt-5">
                <div>
                  <div className="font-display font-black leading-none" style={{ fontSize: 72, color: cfg.accent, textShadow: `0 0 50px ${cfg.accent}40` }}>{fmtRating(player.rating)}</div>
                  <div className="text-sm font-semibold mt-1" style={{ color: '#5070A0' }}>Nota média · {fmtVotes(player.votes)} votos</div>
                </div>
                <div className="pb-1 flex items-center gap-6">
                  <div>
                    <div className="font-display font-black text-white" style={{ fontSize: 28 }}>#1</div>
                    <div className="text-xs" style={{ color: '#3A5070' }}>Ranking geral</div>
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <TrendIcon trend={player.trend} />
                      <span className="font-display font-bold text-white" style={{ fontSize: 14 }}>
                        {player.trend === 'up' ? '+0.3' : player.trend === 'down' ? '-0.2' : '='}
                      </span>
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: '#3A5070' }}>vs semana passada</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-6">
        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-2xl mb-7" style={{ background: '#0A1528' }}>
          {(['stats', 'history', 'info'] as const).map(t => (
            <button key={t} onClick={() => setActiveTab(t)}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200"
              style={{ background: activeTab === t ? '#003087' : 'transparent', color: activeTab === t ? 'white' : '#5070A0' }}>
              {{ stats: 'Estatísticas', history: 'Histórico', info: 'Perfil' }[t]}
            </button>
          ))}
        </div>

        {activeTab === 'stats' && (
          <div className="space-y-5">
            <div className="grid grid-cols-3 gap-3">
              {keyStats.map(({ label, value, icon }) => (
                <div key={label} className="rounded-2xl p-4 text-center"
                  style={{ background: '#0A1528', border: `1px solid ${cfg.border}` }}>
                  <div style={{ fontSize: 22 }}>{icon}</div>
                  <div className="font-display font-black text-white mt-1" style={{ fontSize: 30 }}>{value}</div>
                  <div className="text-xs mt-0.5" style={{ color: '#5070A0' }}>{label}</div>
                </div>
              ))}
            </div>

            <div className="rounded-2xl p-5" style={{ background: '#0A1528', border: '1px solid rgba(255,255,255,0.06)' }}>
              <h3 className="font-display font-bold text-white mb-5" style={{ fontSize: 14 }}>Atributos do Jogador</h3>
              {attrs.map(({ label, v }) => (
                <div key={label} className="mb-3.5">
                  <div className="flex justify-between text-xs mb-1.5">
                    <span style={{ color: '#7090B0' }}>{label}</span>
                    <span className="font-bold" style={{ color: cfg.accent }}>{v}</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                    <div className="h-full rounded-full" style={{ width: `${v}%`, background: `linear-gradient(90deg, ${cfg.accent}70, ${cfg.accent})`, transition: 'width 0.8s ease' }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Best / worst match */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Melhor Partida', opp: 'Atlético-MG', rating: 9.1, result: 'V 3–0', color: '#22C55E' },
                { label: 'Pior Partida', opp: 'Corinthians', rating: 6.2, result: 'D 0–1', color: '#EF4444' },
              ].map(({ label, opp, rating, result, color }) => (
                <div key={label} className="rounded-2xl p-4"
                  style={{ background: '#0A1528', border: `1px solid ${color}25` }}>
                  <div className="text-[10px] font-bold tracking-widest uppercase mb-2" style={{ color: color + '80' }}>{label}</div>
                  <div className="font-display font-black text-white" style={{ fontSize: 11, marginBottom: 4 }}>vs {opp}</div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: color + '15', color }}>{result}</span>
                    <span className="font-display font-black" style={{ fontSize: 20, color }}>{rating.toFixed(1)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-5">
            <div className="rounded-2xl p-5" style={{ background: '#0A1528', border: '1px solid rgba(255,255,255,0.06)' }}>
              <h3 className="font-display font-bold text-white mb-4" style={{ fontSize: 14 }}>Evolução da Nota</h3>
              <div style={{ height: 180 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={CHART_DATA} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id={`rg-${player.id}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={cfg.accent} stopOpacity={0.35} />
                        <stop offset="95%" stopColor={cfg.accent} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="m" tick={{ fill: '#5070A0', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis domain={[5, 10]} tick={{ fill: '#5070A0', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: '#0F2040', border: '1px solid rgba(26,95,204,0.3)', borderRadius: 12, color: 'white', fontSize: 12 }}
                      formatter={(v: number) => [v.toFixed(1), 'Nota']} />
                    <Area type="monotone" dataKey="r" stroke={cfg.accent} strokeWidth={2.5}
                      fill={`url(#rg-${player.id})`} dot={{ fill: cfg.accent, r: 3.5, strokeWidth: 0 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="font-display font-bold text-white mb-3" style={{ fontSize: 14 }}>Últimas Partidas</h3>
              {CHART_DATA.slice().reverse().slice(0, 6).map((d, i) => {
                const high = d.r >= 8
                const mid = d.r >= 6.5 && d.r < 8
                const rColor = high ? '#22C55E' : mid ? '#F59E0B' : '#EF4444'
                return (
                  <div key={i} className="flex items-center gap-4 px-4 py-3 rounded-xl"
                    style={{ background: '#0A1528', border: '1px solid rgba(255,255,255,0.04)' }}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs"
                      style={{ background: 'rgba(26,95,204,0.15)', color: '#4A8EE8' }}>vs</div>
                    <span className="font-display font-bold text-white text-sm flex-1">{d.m}</span>
                    <div className="flex items-center gap-2">
                      {high ? <TrendingUp size={12} className="text-emerald-400" /> : mid ? <Minus size={12} className="text-yellow-400" /> : <TrendingDown size={12} className="text-red-400" />}
                      <span className="font-display font-black" style={{ fontSize: 18, color: rColor }}>{d.r.toFixed(1)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {activeTab === 'info' && (
          <div className="rounded-2xl overflow-hidden" style={{ background: '#0A1528', border: '1px solid rgba(255,255,255,0.06)' }}>
            {[
              { label: 'Nome Completo', value: player.name },
              { label: 'Posição', value: player.pos },
              { label: 'Nacionalidade', value: player.nat },
              { label: 'Idade', value: player.age > 0 ? `${player.age} anos` : '—' },
              { label: 'Número', value: `#${player.num}` },
              { label: 'Raridade', value: RARITY_CFG[player.rarity].label },
              { label: 'Total de Votos', value: player.votes.toLocaleString('pt-BR') },
            ].map(({ label, value }, i, arr) => (
              <div key={label} className="flex items-center justify-between px-5 py-4"
                style={{ borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                <span className="text-sm" style={{ color: '#5070A0' }}>{label}</span>
                <span className="text-sm font-semibold text-white">{value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Match Detail Page ────────────────────────────────────────────────────────

function MatchDetailPage({ match, onBack }: { match: Match; onBack: () => void }) {
  const { players: PLAYERS } = useData()
  const [tab, setTab] = useState<'lineup' | 'stats'>('lineup')
  return (
    <div className="pb-12">
      <div className="relative overflow-hidden" style={{ minHeight: 280 }}>
        <img src="https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=1200&h=400&fit=crop&auto=format"
          alt="Stadium" className="absolute inset-0 w-full h-full object-cover"
          style={{ filter: 'brightness(0.18) saturate(0.5)' }} />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(0,30,80,0.55) 0%, #050D1B 100%)' }} />
        <div className="relative z-10 px-6 pt-6">
          <button onClick={onBack} className="flex items-center gap-2 text-sm mb-5" style={{ color: '#5070A0' }}>
            <ArrowLeft size={15} /> Voltar
          </button>
          <div className="text-center mb-2">
            <span className="text-xs font-bold tracking-widest uppercase" style={{ color: '#5070A0' }}>{match.comp} · {match.round}</span>
          </div>
          <div className="flex items-center justify-center gap-10 py-4">
            <div className="flex flex-col items-center gap-3">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{ background: isCruzeiro(match.home) ? 'linear-gradient(135deg, #003087, #1A5FCC)' : 'rgba(255,255,255,0.08)' }}>
                {isCruzeiro(match.home) ? <CruzeiroCrest size={36} /> : <span className="font-black text-white/50 text-sm">{match.home.slice(0, 3)}</span>}
              </div>
              <span className="font-display font-bold text-white text-center" style={{ fontSize: 14, maxWidth: 100 }}>{match.home}</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              {match.status === 'live' && <LiveBadge minute={match.minute} />}
              {match.status === 'finished' && <span className="text-xs px-3 py-1 rounded-full font-semibold" style={{ background: 'rgba(255,255,255,0.06)', color: '#5070A0' }}>ENCERRADO</span>}
              {match.status === 'upcoming' && <span className="text-xs px-3 py-1 rounded-full font-semibold" style={{ background: 'rgba(26,95,204,0.18)', color: '#4A8EE8' }}>PRÓXIMA</span>}
              <div className="flex items-center gap-3">
                <span className="font-display font-black text-white" style={{ fontSize: 60, lineHeight: 1 }}>{match.homeScore}</span>
                <span className="font-display font-thin" style={{ fontSize: 36, color: 'rgba(255,255,255,0.18)' }}>:</span>
                <span className="font-display font-black text-white" style={{ fontSize: 60, lineHeight: 1, opacity: 0.6 }}>{match.awayScore}</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs" style={{ color: '#3A5070' }}>
                <MapPin size={11} />{match.venue}
              </div>
            </div>
            <div className="flex flex-col items-center gap-3">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{ background: isCruzeiro(match.away) ? 'linear-gradient(135deg, #003087, #1A5FCC)' : 'rgba(255,255,255,0.08)' }}>
                {isCruzeiro(match.away) ? <CruzeiroCrest size={36} /> : <span className="font-black text-white/50 text-sm">{match.away.slice(0, 3)}</span>}
              </div>
              <span className="font-display font-bold text-white text-center" style={{ fontSize: 14, maxWidth: 100 }}>{match.away}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="px-6">
        <div className="flex gap-1 p-1 rounded-2xl mb-6" style={{ background: '#0A1528' }}>
          {(['lineup', 'stats'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150"
              style={{ background: tab === t ? '#003087' : 'transparent', color: tab === t ? 'white' : '#5070A0' }}>
              {t === 'lineup' ? 'Escalação' : 'Estatísticas'}
            </button>
          ))}
        </div>

        {tab === 'lineup' && (
          <div>
            <h3 className="font-display font-bold text-white mb-4" style={{ fontSize: 14 }}>Cruzeiro — Avaliações</h3>
            <div className="grid grid-cols-2 gap-2">
              {PLAYERS.slice(0, 8).map(p => (
                <div key={p.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                  style={{ background: '#0A1528', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div className="relative w-8 h-8 rounded-lg overflow-hidden flex-shrink-0"
                    style={{ background: RARITY_CFG[p.rarity].photoGrad }}>
                    <div className="w-full h-full flex items-center justify-center font-display font-black opacity-30 text-white" style={{ fontSize: 14 }}>{p.num}</div>
                    {p.photo && (
                      <img src={p.photo} alt={p.name} className="absolute inset-0 w-full h-full object-cover object-top select-none" draggable={false} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-white truncate">{p.short}</div>
                    <PosBadge pos={p.pos} />
                  </div>
                  <span className="font-display font-black" style={{ fontSize: 15, color: RARITY_CFG[p.rarity].accent }}>{fmtRating(p.rating)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'stats' && (
          <div className="space-y-2.5">
            {[
              { label: 'Posse de Bola', home: 58, away: 42, unit: '%' },
              { label: 'Finalizações', home: 14, away: 8, unit: '' },
              { label: 'Chutes no Gol', home: 6, away: 3, unit: '' },
              { label: 'Escanteios', home: 7, away: 4, unit: '' },
              { label: 'Faltas', home: 11, away: 16, unit: '' },
              { label: 'Cartões Amarelos', home: 2, away: 3, unit: '' },
            ].map(({ label, home, away, unit }) => {
              const total = home + away
              const homePct = Math.round((home / total) * 100)
              return (
                <div key={label} className="rounded-xl px-4 py-3" style={{ background: '#0A1528' }}>
                  <div className="flex justify-between text-xs mb-2">
                    <span className="font-bold text-white">{home}{unit}</span>
                    <span style={{ color: '#5070A0' }}>{label}</span>
                    <span className="font-bold" style={{ color: '#5070A0' }}>{away}{unit}</span>
                  </div>
                  <div className="flex h-1.5 rounded-full overflow-hidden gap-0.5">
                    <div className="rounded-l-full" style={{ width: `${homePct}%`, background: 'linear-gradient(90deg, #1A5FCC, #4A8EE8)' }} />
                    <div className="rounded-r-full flex-1" style={{ background: 'rgba(255,255,255,0.08)' }} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Rating Page ──────────────────────────────────────────────────────────────

function RatingPage() {
  const { players: PLAYERS, matches: MATCHES } = useData()
  const lastFinished = MATCHES.find(m => m.status === 'finished') ?? null
  const [currentIdx, setCurrentIdx] = useState(0)
  const [ratings, setRatings] = useState<Record<number, number>>({})
  const [hoveredRating, setHoveredRating] = useState<number | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [flash, setFlash] = useState(false)

  const player = PLAYERS[currentIdx]
  const selected = ratings[player.id]
  const progress = (Object.keys(ratings).length / PLAYERS.length) * 100
  const cfg = RARITY_CFG[player.rarity]

  const handleRate = (r: number) => {
    setFlash(true)
    setTimeout(() => {
      setFlash(false)
      setRatings(prev => ({ ...prev, [player.id]: r }))
      if (currentIdx < PLAYERS.length - 1) setCurrentIdx(i => i + 1)
    }, 350)
  }

  const handleSubmit = () => {
    const finalRatings = { ...ratings }
    PLAYERS.forEach(p => { if (finalRatings[p.id] === undefined) finalRatings[p.id] = 5 })
    setRatings(finalRatings)
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center px-6 text-center" style={{ minHeight: 'calc(100vh - 60px)' }}>
        <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6"
          style={{ background: 'linear-gradient(135deg, #003087, #1A5FCC)', boxShadow: '0 0 50px rgba(26,95,204,0.5)' }}>
          <CheckCircle size={36} className="text-white" />
        </div>
        <h2 className="font-display font-black text-white mb-2" style={{ fontSize: 30 }}>Avaliação Enviada!</h2>
        <p className="text-sm mb-8" style={{ color: '#5070A0' }}>Obrigado por contribuir com a torcida Cruzeiro.</p>
        <div className="grid grid-cols-3 gap-3 w-full max-w-xs mb-8">
          {PLAYERS.slice(0, 6).map(p => (
            <div key={p.id} className="rounded-2xl p-3 text-center"
              style={{ background: '#0A1528', border: `1px solid ${RARITY_CFG[p.rarity].border}` }}>
              <div className="text-[10px] font-semibold text-white truncate">{p.short}</div>
              <div className="font-display font-black mt-1" style={{ color: RARITY_CFG[p.rarity].accent, fontSize: 20 }}>
                {ratings[p.id]?.toFixed(1) ?? '—'}
              </div>
            </div>
          ))}
        </div>
        <button onClick={() => { setSubmitted(false); setCurrentIdx(0); setRatings({}) }}
          className="px-8 py-3 rounded-2xl font-display font-bold text-white text-sm"
          style={{ background: 'linear-gradient(135deg, #003087, #1A5FCC)', boxShadow: '0 4px 20px rgba(26,95,204,0.4)' }}>
          Avaliar Novamente
        </button>
      </div>
    )
  }

  return (
    <div className="px-6 pb-12">
      {/* Header */}
      <div className="pt-6 pb-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-display font-black text-white" style={{ fontSize: 22 }}>Votar</h2>
            <p className="text-xs mt-0.5" style={{ color: '#5070A0' }}>{lastFinished ? `${lastFinished.home} × ${lastFinished.away} · ${lastFinished.date}` : 'Avalie os jogadores do Cruzeiro'}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-display font-bold" style={{ color: '#3A5070', fontSize: 13 }}>{Object.keys(ratings).length}/{PLAYERS.length} avaliados</span>
          </div>
        </div>
        <div className="h-0.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #003087, #4A8EE8)' }} />
        </div>
      </div>

      {/* Two-column layout */}
      <div className="flex gap-6 items-start">

        {/* Right — Card + Rating selector */}
        <div className="flex flex-col items-center gap-6 flex-1">
          <div style={{ transform: flash ? 'scale(1.08)' : 'scale(1)', transition: 'transform 0.2s ease', filter: flash ? `drop-shadow(0 0 28px ${cfg.accent})` : 'none' }}>
            <PlayerCard player={player} />
          </div>

          <div className="w-full">
            <div className="text-center mb-1">
              <h3 className="font-display font-black text-white" style={{ fontSize: 20 }}>{player.name}</h3>
              <div className="flex items-center justify-center gap-2 mt-1.5">
                <PosBadge pos={player.pos} />
                <span className="text-sm" style={{ color: '#5070A0' }}>{player.nat}{player.age > 0 ? ` · ${player.age} anos` : ''}</span>
              </div>
            </div>

            {selected ? (
              <div className="text-center mt-3 mb-1">
                <div className="font-display font-black" style={{ fontSize: 44, color: cfg.accent, lineHeight: 1 }}>{selected.toFixed(1)}</div>
                <div className="text-xs mt-1" style={{ color: '#3A5070' }}>nota atribuída</div>
              </div>
            ) : (
              <div className="text-center mt-3 mb-1">
                <p className="text-sm font-semibold" style={{ color: '#7090B0' }}>Qual nota para {player.short}?</p>
              </div>
            )}

            <div className="grid grid-cols-5 gap-2 mt-4">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(r => {
                const active = (hoveredRating ?? selected ?? 0) >= r
                const rColor = r <= 4 ? '#EF4444' : r <= 6 ? '#F59E0B' : r <= 8 ? '#4A8EE8' : '#22C55E'
                return (
                  <button key={r}
                    onClick={() => handleRate(r)}
                    onMouseEnter={() => setHoveredRating(r)}
                    onMouseLeave={() => setHoveredRating(null)}
                    className="rounded-2xl py-3 font-display font-black transition-all duration-100"
                    style={{
                      fontSize: 20,
                      background: active ? rColor + '22' : 'rgba(255,255,255,0.04)',
                      border: `2px solid ${active ? rColor + '55' : 'rgba(255,255,255,0.06)'}`,
                      color: active ? rColor : '#2A3A50',
                      boxShadow: active ? `0 2px 6px ${rColor}18` : 'none',
                    }}>
                    {r}
                  </button>
                )
              })}
            </div>

            {/* Submit button */}
            <button
              onClick={handleSubmit}
              className="w-full mt-5 py-3.5 rounded-2xl font-display font-bold text-white text-sm transition-all duration-200"
              style={{ background: 'linear-gradient(135deg, #003087, #1A5FCC)', boxShadow: '0 4px 20px rgba(26,95,204,0.35)' }}>
              Enviar Avaliações
              {Object.keys(ratings).length < PLAYERS.length && (
                <span className="ml-2 text-xs font-semibold opacity-60">
                  ({PLAYERS.length - Object.keys(ratings).length} sem nota receberão 5.0)
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Left — Player roster list */}
        <div className="order-first flex-shrink-0" style={{ width: 400 }}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold tracking-widest uppercase" style={{ color: '#2A3A50' }}>Elenco</span>
            <span className="text-xs" style={{ color: '#2A3A50' }}>{Object.keys(ratings).length} de {PLAYERS.length}</span>
          </div>
          <div className="space-y-1.5">
            {PLAYERS.map((p, i) => {
              const isActive = p.id === player.id
              const rated = ratings[p.id]
              const pcfg = RARITY_CFG[p.rarity]
              const ratedColor = rated
                ? rated <= 4 ? '#EF4444' : rated <= 6 ? '#F59E0B' : rated <= 8 ? '#4A8EE8' : '#22C55E'
                : null

              return (
                <button
                  key={p.id}
                  onClick={() => setCurrentIdx(i)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-left transition-all duration-150"
                  style={{
                    background: isActive
                      ? `linear-gradient(135deg, ${pcfg.accent}12, rgba(26,95,204,0.12))`
                      : rated
                        ? 'rgba(255,255,255,0.025)'
                        : '#0A1528',
                    border: isActive
                      ? `1px solid ${pcfg.accent}40`
                      : `1px solid ${rated ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.04)'}`,
                  }}
                >
                  {/* Jersey / photo area */}
                  <div className="w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center overflow-hidden relative"
                    style={{ background: pcfg.photoGrad, border: `1px solid ${pcfg.border}` }}>
                    <span className="font-display font-black opacity-40 text-white select-none" style={{ fontSize: 16 }}>{p.num}</span>
                    {p.photo && (
                      <img src={p.photo} alt={p.name} className="absolute inset-0 w-full h-full object-cover object-top select-none" draggable={false} />
                    )}
                    {isActive && (
                      <div className="absolute inset-0 rounded-xl" style={{ background: `${pcfg.accent}20`, border: `1px solid ${pcfg.accent}60` }} />
                    )}
                  </div>

                  {/* Name + pos */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-display font-semibold truncate" style={{ fontSize: 13, color: isActive ? 'white' : rated ? '#8098B0' : '#6080A0' }}>
                        {p.name}
                      </span>
                      {isActive && <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: pcfg.accent }} />}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <PosBadge pos={p.pos} />
                      <span className="text-[10px]" style={{ color: '#3A5070' }}>{p.flag}</span>
                    </div>
                  </div>

                  {/* Rating or pending */}
                  <div className="flex-shrink-0 text-right" style={{ minWidth: 44 }}>
                    {rated ? (
                      <div>
                        <div className="font-display font-black" style={{ fontSize: 18, color: ratedColor!, lineHeight: 1 }}>{rated.toFixed(1)}</div>
                        <div className="text-[9px] mt-0.5" style={{ color: '#2A3A50' }}>avaliado</div>
                      </div>
                    ) : isActive ? (
                      <div className="text-[10px] font-bold px-2 py-1 rounded-lg" style={{ background: `${pcfg.accent}18`, color: pcfg.accent }}>agora</div>
                    ) : (
                      <div className="text-[10px]" style={{ color: '#1A2A3A' }}>—</div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

      </div>

      {/* Skip link */}
    </div>
  )
}

// ─── Admin Page ───────────────────────────────────────────────────────────────

function AdminPage() {
  const { players: PLAYERS } = useData()
  return (
    <div className="px-6 pb-12">
      <div className="pt-8 pb-6">
        <div className="flex items-center gap-2 mb-1">
          <Shield size={15} style={{ color: '#C4972A' }} />
          <span className="text-xs font-bold tracking-widest uppercase" style={{ color: '#C4972A' }}>Painel Administrativo</span>
        </div>
        <h2 className="font-display font-black text-white mb-1" style={{ fontSize: 30 }}>Dashboard</h2>
        <p className="text-sm" style={{ color: '#5070A0' }}>Temporada 2024 · Brasileirão Série A</p>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-8">
        {[
          { icon: Vote, label: 'Total Votos', value: '62.080', delta: '+12%', color: '#4A8EE8' },
          { icon: Users, label: 'Usuários Ativos', value: '8.420', delta: '+24%', color: '#22C55E' },
          { icon: Star, label: 'Nota Média', value: '7.38', delta: '+0.2', color: '#C4972A' },
          { icon: Activity, label: 'Partidas Avaliadas', value: '17', delta: '34 total', color: '#8B5CF6' },
        ].map(({ icon: Icon, label, value, delta, color }) => (
          <div key={label} className="rounded-2xl p-5" style={{ background: '#0A1528', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: color + '12' }}>
                <Icon size={16} style={{ color }} />
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: '#22C55E12', color: '#22C55E' }}>{delta}</span>
            </div>
            <div className="font-display font-black text-white" style={{ fontSize: 24 }}>{value}</div>
            <div className="text-xs mt-0.5" style={{ color: '#5070A0' }}>{label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-6 mb-6">
        <div className="col-span-2 rounded-2xl p-5" style={{ background: '#0A1528', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-display font-bold text-white" style={{ fontSize: 14 }}>Votos por Partida</h3>
            <span className="text-xs" style={{ color: '#3A5070' }}>Temporada 2024</span>
          </div>
          <div style={{ height: 180 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={CHART_DATA} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="m" tick={{ fill: '#5070A0', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#5070A0', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: '#0F2040', border: '1px solid rgba(26,95,204,0.3)', borderRadius: 12, color: 'white', fontSize: 12 }}
                  cursor={{ fill: 'rgba(26,95,204,0.07)' }} />
                <Bar dataKey="votes" fill="#1A5FCC" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl p-5" style={{ background: '#0A1528', border: '1px solid rgba(255,255,255,0.05)' }}>
          <h3 className="font-display font-bold text-white mb-4" style={{ fontSize: 14 }}>Mais Votados</h3>
          <div className="space-y-3">
            {PLAYERS.slice(0, 5).map((p, i) => (
              <div key={p.id} className="flex items-center gap-3">
                <span className="font-display font-black text-xs w-4 text-center" style={{ color: i === 0 ? '#C4972A' : '#2A3A50' }}>#{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-white truncate">{p.short}</div>
                  <div className="h-1 rounded-full mt-1 overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                    <div className="h-full rounded-full" style={{ width: `${(p.votes / 13000) * 100}%`, background: RARITY_CFG[p.rarity].accent }} />
                  </div>
                </div>
                <span className="text-xs font-bold" style={{ color: '#3A5070' }}>{fmtVotes(p.votes)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ background: '#0A1528', border: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <h3 className="font-display font-bold text-white" style={{ fontSize: 14 }}>Atividade Recente</h3>
        </div>
        {[
          { action: 'Nova avaliação', detail: 'rodrigo_cruzeiro avaliou Matheus Pereira: 9.5', time: '2 min', icon: Star, color: '#C4972A' },
          { action: 'Partida adicionada', detail: 'Cruzeiro × Internacional adicionada — 20/07', time: '1h', icon: Calendar, color: '#4A8EE8' },
          { action: 'Novo usuário', detail: 'cabuloso_bh se registrou na plataforma', time: '2h', icon: Users, color: '#22C55E' },
          { action: 'Nova avaliação', detail: 'raposa_eterna avaliou Kaio Jorge: 8.0', time: '3h', icon: Star, color: '#C4972A' },
        ].map(({ action, detail, time, icon: Icon, color }, i, arr) => (
          <div key={i} className="flex items-start gap-4 px-5 py-4"
            style={{ borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
            <div className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center" style={{ background: color + '12' }}>
              <Icon size={14} style={{ color }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-white">{action}</div>
              <div className="text-xs mt-0.5 truncate" style={{ color: '#5070A0' }}>{detail}</div>
            </div>
            <span className="text-xs flex-shrink-0" style={{ color: '#2A3A50' }}>{time}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Auth Page ────────────────────────────────────────────────────────────────

function AuthPage({ onAuth }: { onAuth: () => void }) {
  const [tab, setTab] = useState<'login' | 'register'>('login')
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' })
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const validate = () => {
    const errs: Record<string, string> = {}
    if (tab === 'register' && !form.name.trim()) errs.name = 'Informe seu nome'
    if (!form.email.includes('@')) errs.email = 'E-mail inválido'
    if (form.password.length < 6) errs.password = 'Mínimo 6 caracteres'
    if (tab === 'register' && form.password !== form.confirm) errs.confirm = 'Senhas não coincidem'
    return errs
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setErrors({})
    setLoading(true)
    setTimeout(() => { setLoading(false); onAuth() }, 1200)
  }

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: '#030910' }}>

      {/* Left — Hero */}
      <div className="relative hidden lg:flex flex-col justify-between overflow-hidden" style={{ width: '52%' }}>
        <img
          src={fotoCapa}
          alt="Foto capa JeanScore"
          className="absolute inset-0 w-full h-full object-cover"
          style={{ filter: 'brightness(0.22) saturate(0.6)' }}
        />
        {/* Gradient overlays */}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, rgba(0,48,135,0.75) 0%, rgba(3,9,16,0.4) 60%, transparent 100%)' }} />
        <div className="absolute inset-y-0 right-0 w-32" style={{ background: 'linear-gradient(90deg, transparent, #030910)' }} />
        <div className="absolute inset-x-0 bottom-0 h-48" style={{ background: 'linear-gradient(0deg, #030910 0%, transparent 100%)' }} />

        {/* Content */}
        <div className="relative z-10 p-12">
          <JeanScoreLogo width={180} showStars={true} />
        </div>

        <div className="relative z-10 p-12">
          <div className="mb-3">
            <span className="text-xs font-bold tracking-widest uppercase px-3 py-1.5 rounded-full"
              style={{ background: 'rgba(196,151,42,0.15)', color: '#C4972A', border: '1px solid rgba(196,151,42,0.25)' }}>
              Temporada 2024
            </span>
          </div>
          <h1 className="font-display font-black text-white mb-4" style={{ fontSize: 42, lineHeight: 1.05, letterSpacing: '-0.02em' }}>
            A voz da<br />
            <span style={{ background: 'linear-gradient(90deg, #4A8EE8, #C4972A)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Nação Azul
            </span>
          </h1>
          <p className="text-sm leading-relaxed mb-8" style={{ color: 'rgba(255,255,255,0.45)', maxWidth: 340 }}>
            Avalie os jogadores do Cruzeiro, acompanhe rankings e compare sua opinião com a torcida.
          </p>

          {/* Social proof */}
          <div className="flex items-center gap-4">
            <div className="flex -space-x-2">
              {['R', 'C', 'M', 'A'].map((l, i) => (
                <div key={i} className="w-8 h-8 rounded-full flex items-center justify-center font-display font-black text-xs text-white border-2"
                  style={{ background: `linear-gradient(135deg, #003087, #1A5FCC)`, borderColor: '#030910' }}>
                  {l}
                </div>
              ))}
            </div>
            <div>
              <div className="font-display font-bold text-white text-sm">+8.400 torcedores</div>
              <div className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>já estão avaliando</div>
            </div>
          </div>
        </div>
      </div>

      {/* Right — Form */}
      <div className="flex flex-1 flex-col items-center justify-center px-8 py-12">

        <div style={{ width: '100%', maxWidth: 420 }}>

          {/* Mobile logo */}
          <div className="flex lg:hidden mb-10">
            <JeanScoreLogo width={160} showStars={false} />
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h2 className="font-display font-black text-white mb-1.5" style={{ fontSize: 28 }}>
              {tab === 'login' ? 'Bem-vindo de volta' : 'Criar conta'}
            </h2>
            <p className="text-sm" style={{ color: '#5070A0' }}>
              {tab === 'login' ? 'Entre para continuar avaliando' : 'Junte-se à torcida Cruzeiro'}
            </p>
          </div>

          {/* Tabs */}
          <div className="flex p-1 rounded-2xl mb-8" style={{ background: '#0A1528' }}>
            {(['login', 'register'] as const).map(t => (
              <button key={t} onClick={() => { setTab(t); setErrors({}) }}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200"
                style={{ background: tab === t ? '#003087' : 'transparent', color: tab === t ? 'white' : '#5070A0' }}>
                {t === 'login' ? 'Entrar' : 'Cadastrar'}
              </button>
            ))}
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {tab === 'register' && (
              <Field label="Nome completo" error={errors.name}>
                <input type="text" placeholder="Seu nome" value={form.name} onChange={set('name')}
                  className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none transition-all duration-150"
                  style={{ background: '#0A1528', border: `1px solid ${errors.name ? '#EF444450' : 'rgba(255,255,255,0.07)'}`, fontFamily: 'Inter, sans-serif' }} />
              </Field>
            )}

            <Field label="E-mail" error={errors.email}>
              <input type="email" placeholder="seu@email.com" value={form.email} onChange={set('email')}
                className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none transition-all duration-150"
                style={{ background: '#0A1528', border: `1px solid ${errors.email ? '#EF444450' : 'rgba(255,255,255,0.07)'}`, fontFamily: 'Inter, sans-serif' }} />
            </Field>

            <Field label="Senha" error={errors.password}>
              <input type="password" placeholder="••••••••" value={form.password} onChange={set('password')}
                className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none transition-all duration-150"
                style={{ background: '#0A1528', border: `1px solid ${errors.password ? '#EF444450' : 'rgba(255,255,255,0.07)'}`, fontFamily: 'Inter, sans-serif' }} />
            </Field>

            {tab === 'register' && (
              <Field label="Confirmar senha" error={errors.confirm}>
                <input type="password" placeholder="••••••••" value={form.confirm} onChange={set('confirm')}
                  className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none transition-all duration-150"
                  style={{ background: '#0A1528', border: `1px solid ${errors.confirm ? '#EF444450' : 'rgba(255,255,255,0.07)'}`, fontFamily: 'Inter, sans-serif' }} />
              </Field>
            )}

            {tab === 'login' && (
              <div className="flex justify-end">
                <button type="button" className="text-xs font-semibold" style={{ color: '#4A8EE8' }}>
                  Esqueci minha senha
                </button>
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full py-3.5 rounded-2xl font-display font-bold text-white text-sm mt-2 transition-all duration-200 flex items-center justify-center gap-2"
              style={{
                background: loading ? 'rgba(26,95,204,0.5)' : 'linear-gradient(135deg, #003087, #1A5FCC)',
                boxShadow: loading ? 'none' : '0 4px 20px rgba(26,95,204,0.4)',
                cursor: loading ? 'not-allowed' : 'pointer',
              }}>
              {loading ? (
                <>
                  <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  {tab === 'login' ? 'Entrando...' : 'Criando conta...'}
                </>
              ) : (
                tab === 'login' ? 'Entrar' : 'Criar conta'
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
            <span className="text-xs" style={{ color: '#2A3A50' }}>ou</span>
            <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
          </div>

          {/* Guest access */}
          <button onClick={onAuth}
            className="w-full py-3 rounded-2xl text-sm font-semibold transition-all duration-150"
            style={{ background: 'rgba(255,255,255,0.04)', color: '#5070A0', border: '1px solid rgba(255,255,255,0.06)' }}>
            Continuar como visitante
          </button>

          <p className="text-center text-xs mt-6" style={{ color: '#2A3A50' }}>
            Ao entrar você concorda com os{' '}
            <span className="text-[#3A5070] cursor-pointer hover:text-[#4A8EE8] transition-colors">Termos de Uso</span>
            {' '}e a{' '}
            <span className="text-[#3A5070] cursor-pointer hover:text-[#4A8EE8] transition-colors">Política de Privacidade</span>
          </p>
        </div>
      </div>
    </div>
  )
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold mb-1.5" style={{ color: '#7090B0' }}>{label}</label>
      {children}
      {error && <p className="text-xs mt-1" style={{ color: '#EF4444' }}>{error}</p>}
    </div>
  )
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [authed, setAuthed] = useState(false)
  const [page, setPage] = useState<Page>('home')
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null)
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null)
  const [prevPage, setPrevPage] = useState<Page>('home')

  const navigate = (p: Page) => {
    setPrevPage(page)
    setPage(p)
  }

  const PAGE_TITLES: Record<Page, string> = {
    home: 'JeanScore', rankings: 'Rankings', players: 'Jogadores',
    matches: 'Partidas', rate: 'Votar', admin: 'Admin',
    profile: selectedPlayer?.name ?? 'Perfil',
    'match-detail': selectedMatch ? `${selectedMatch.home} × ${selectedMatch.away}` : 'Partida',
  }

  const detailPage = page === 'profile' || page === 'match-detail'

  if (!authed) return <AuthPage onAuth={() => setAuthed(true)} />

  return (
    <DataProvider>
    <div style={{ minHeight: '100vh', backgroundColor: '#050D1B', fontFamily: "'Inter', system-ui, sans-serif" }}>
      <Sidebar page={page} setPage={navigate} />

      <main style={{ marginLeft: 60, minHeight: '100vh' }}>
        {!detailPage && <TopBar title={PAGE_TITLES[page]} />}

        {page === 'home' && (
          <HomePage setPage={navigate} setSelectedPlayer={setSelectedPlayer} setSelectedMatch={setSelectedMatch} />
        )}
        {page === 'rankings' && (
          <RankingsPage setPage={navigate} setSelectedPlayer={setSelectedPlayer} />
        )}
        {page === 'players' && (
          <PlayersPage setPage={navigate} setSelectedPlayer={setSelectedPlayer} />
        )}
        {page === 'matches' && (
          <MatchesPage setPage={navigate} setSelectedMatch={setSelectedMatch} />
        )}
        {page === 'rate' && <RatingPage />}
        {page === 'admin' && <AdminPage />}
        {page === 'profile' && selectedPlayer && (
          <PlayerProfilePage player={selectedPlayer} onBack={() => setPage(prevPage)} />
        )}
        {page === 'match-detail' && selectedMatch && (
          <MatchDetailPage match={selectedMatch} onBack={() => setPage(prevPage)} />
        )}
      </main>
    </div>
    </DataProvider>
  )
}
