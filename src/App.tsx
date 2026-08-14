import { useState, useEffect, useRef, createContext, useContext, type ReactNode } from 'react'
import fotoCapa from './imports/Foto_Capa.jpg'
import fotoFundoInicio from './imports/Foto_Fundo_Inicio.jpg'
import cruzeiroLogo from './imports/cruzeiro_logo.png'
import { supabase } from './supabase'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, CartesianGrid, RadarChart, Radar, PolarGrid, PolarAngleAxis,
} from 'recharts'
import {
  Home, Trophy, Users, Calendar, Star, Settings, ChevronRight,
  TrendingUp, TrendingDown, Minus, MapPin, Clock, Award,
  Search, ArrowLeft, Shield, Target,
  Activity, Vote, Crown, Flame, CheckCircle,
  BarChart2, Zap, Eye, Heart, LogOut, Dices, Lock,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type Page = 'home' | 'rankings' | 'players' | 'matches' | 'rate' | 'bolao' | 'admin' | 'profile' | 'match-detail'
type Rarity = 'bronze' | 'silver' | 'gold' | 'legendary'
type Pos = 'GK' | 'CB' | 'LB' | 'RB' | 'CDM' | 'CM' | 'CAM' | 'LW' | 'RW' | 'ST'

interface Player {
  id: number; name: string; short: string; pos: Pos; rating: number;
  votes: number; flag: string; rarity: Rarity; num: number; goals: number;
  assists: number; matches: number; trend: 'up' | 'down' | 'stable';
  nat: string; age: number; cleanSheets?: number; saves?: number; photo?: string; dbId?: string; attrOverall?: number; flagCode?: string;
}

/** Editable per-match statistics. Each key maps to a home/away pair. */
const STAT_FIELDS = [
  { key: 'possession', label: 'Posse de Bola', unit: '%' },
  { key: 'shots', label: 'Finalizações', unit: '' },
  { key: 'shots_target', label: 'Chutes no Gol', unit: '' },
  { key: 'corners', label: 'Escanteios', unit: '' },
  { key: 'fouls', label: 'Faltas', unit: '' },
  { key: 'yellow', label: 'Cartões Amarelos', unit: '' },
] as const

type StatKey = typeof STAT_FIELDS[number]['key']
type MatchStats = Partial<Record<StatKey, { home: number; away: number }>>

interface Match {
  id: number; home: string; away: string; homeScore: number; awayScore: number;
  date: string; comp: string; status: 'live' | 'finished' | 'upcoming';
  minute?: number; venue: string; round: string; dbId?: string; liberado?: boolean; ts?: number;
  stats?: MatchStats;
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

/** Attribute set voted by the community, per position group. */
const ATTRIBUTE_SETS: Record<'GK' | 'ST' | 'OUTFIELD', string[]> = {
  GK: ['Reflexos', 'Posicionamento', 'Saída', 'Comando', 'Distribuição'],
  ST: ['Finalização', 'Velocidade', 'Cabeceio', 'Drible', 'Posicionamento'],
  OUTFIELD: ['Passe', 'Visão', 'Drible', 'Posicionamento', 'Finalização'],
}

/** Returns the attribute labels for a player's position. */
const attributesFor = (pos: Pos): string[] =>
  pos === 'GK' ? ATTRIBUTE_SETS.GK : pos === 'ST' ? ATTRIBUTE_SETS.ST : ATTRIBUTE_SETS.OUTFIELD

/** Card rarity derived from a player's average rating (0 = unrated → bronze). */
const rarityFromRating = (r: number): Rarity =>
  r >= 8.5 ? 'legendary' : r >= 7.5 ? 'gold' : r >= 6 ? 'silver' : 'bronze'

/** Short "há X" relative time from an ISO timestamp. */
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'agora'
  if (min < 60) return `${min}min`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

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
  liberado: boolean
  // Optional per-match statistics columns (added via supabase-stats.sql).
  possession_home?: number | null; possession_away?: number | null
  shots_home?: number | null; shots_away?: number | null
  shots_target_home?: number | null; shots_target_away?: number | null
  corners_home?: number | null; corners_away?: number | null
  fouls_home?: number | null; fouls_away?: number | null
  yellow_home?: number | null; yellow_away?: number | null
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

/** ISO 3166-1 alpha-2 code per nationality, for the flag image (flagcdn). */
const NAT_CODE: Record<string, string> = {
  Brazil: 'br', Uruguay: 'uy', Colombia: 'co', Argentina: 'ar',
  Ecuador: 'ec', Venezuela: 've', Paraguay: 'py', Chile: 'cl',
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
    flagCode: NAT_CODE[nat],
    rarity: 'bronze',
    num: row.number ? parseInt(row.number, 10) : 0,
    goals: 0,
    assists: 0,
    matches: 0,
    trend: 'stable',
    nat: NAT_PT[nat] ?? nat,
    age: 0,
    photo: row.photo ?? undefined,
    dbId: row.id,
  }
}

function fmtFixtureDate(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function mapFixtureRowToMatch(row: DbFixtureRow, index: number): Match {
  // Fold the optional stat columns into a compact structure. A stat is included
  // when at least one side has a value (null columns are treated as 0).
  const stats: MatchStats = {}
  for (const { key } of STAT_FIELDS) {
    const h = (row as Record<string, unknown>)[`${key}_home`] as number | null | undefined
    const a = (row as Record<string, unknown>)[`${key}_away`] as number | null | undefined
    if (h != null || a != null) stats[key] = { home: h ?? 0, away: a ?? 0 }
  }
  return {
    id: index + 1,
    home: row.home_team,
    away: row.away_team,
    homeScore: row.home_score ?? 0,
    awayScore: row.away_score ?? 0,
    date: fmtFixtureDate(row.fixture_date),
    comp: row.competition,
    // Classify by the current date: past kickoff = realizada, future = próxima.
    status: (row.ts ? row.ts * 1000 : new Date(row.fixture_date).getTime()) <= Date.now() ? 'finished' : 'upcoming',
    venue: row.stadium ?? '',
    round: '',
    dbId: row.id,
    liberado: row.liberado ?? false,
    ts: row.ts,
    stats: Object.keys(stats).length > 0 ? stats : undefined,
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

interface DbRatingRow {
  id: string
  user_id: string
  user_name: string
  player_id: string
  fixture_id: string
  score: number
  created_at: string
}

interface DbAttributeRating {
  id: string
  user_id: string
  player_id: string
  attribute: string
  score: number
}

interface JeanData {
  players: Player[]
  matches: Match[]
  standings: DbStandingRow[]
  competitions: DbCompetitionStatus[]
  recentRatings: DbRatingRow[]
  ratings: DbRatingRow[]
  attributeRatings: DbAttributeRating[]
  fixturePlayers: { fixture_id: string; player_id: string }[]
  squadRows: DbSquadRow[]
  fixtureRows: DbFixtureRow[]
  loading: boolean
  reload: () => void
}

const DataContext = createContext<JeanData>({ players: MOCK_PLAYERS, matches: MOCK_MATCHES, standings: [], competitions: [], recentRatings: [], ratings: [], attributeRatings: [], fixturePlayers: [], squadRows: [], fixtureRows: [], loading: true, reload: () => {} })

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
  const [recentRatings, setRecentRatings] = useState<DbRatingRow[]>([])
  const [ratings, setRatings] = useState<DbRatingRow[]>([])
  const [attributeRatings, setAttributeRatings] = useState<DbAttributeRating[]>([])
  const [fixturePlayers, setFixturePlayers] = useState<{ fixture_id: string; player_id: string }[]>([])
  const [squadRows, setSquadRows] = useState<DbSquadRow[]>([])
  const [fixtureRows, setFixtureRows] = useState<DbFixtureRow[]>([])
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)
  const reload = () => setTick((t) => t + 1)

  useEffect(() => {
    let active = true
    ;(async () => {
      // Ratings first (public read) so we can fold season averages into the squad.
      let ratingRows: DbRatingRow[] = []
      try {
        ratingRows = await supaGet<DbRatingRow[]>('ratings?select=*&order=created_at.desc')
      } catch { /* ratings table may not exist yet */ }
      const agg = new Map<string, { sum: number; n: number }>()
      for (const r of ratingRows) {
        const a = agg.get(r.player_id) ?? { sum: 0, n: 0 }
        a.sum += Number(r.score)
        a.n += 1
        agg.set(r.player_id, a)
      }

      // Attribute votes → per-player overall (0–99). Optional table.
      let attrRows: DbAttributeRating[] = []
      try {
        attrRows = await supaGet<DbAttributeRating[]>('attribute_ratings?select=id,user_id,player_id,attribute,score')
      } catch { /* attribute_ratings table may not exist yet */ }
      const attrAgg = new Map<string, { sum: number; n: number }>()
      for (const a of attrRows) {
        const x = attrAgg.get(a.player_id) ?? { sum: 0, n: 0 }
        x.sum += Number(a.score)
        x.n += 1
        attrAgg.set(a.player_id, x)
      }

      try {
        const [squad, fixtures] = await Promise.all([
          supaGet<DbSquadRow[]>('squad?select=id,name,position,number,photo,nationality&order=name.asc'),
          supaGet<DbFixtureRow[]>('fixtures?select=*'),
        ])
        if (!active) return
        setSquadRows(squad)
        setFixtureRows(fixtures)
        if (squad.length > 0) {
          setPlayers(squad.map((row, i) => {
            const p = mapSquadRowToPlayer(row, i)
            const a = agg.get(row.id)
            if (a && a.n > 0) {
              const avg = Math.round((a.sum / a.n) * 10) / 10
              p.rating = avg
              p.votes = a.n
              p.rarity = rarityFromRating(avg)
            }
            const av = attrAgg.get(row.id)
            if (av && av.n > 0) p.attrOverall = Math.round(av.sum / av.n)
            return p
          }))
        }
        if (fixtures.length > 0) {
          // Map first so the status is derived from the current date, then bucket
          // by that derived status: most recent results first, upcoming next.
          // (The DB `status` column can be stale — e.g. a played game still marked
          // "notstarted" — so we must not sort by it.)
          const mapped = fixtures.map(mapFixtureRowToMatch)
          const finished = mapped.filter((m) => m.status === 'finished').sort((a, b) => (b.ts ?? 0) - (a.ts ?? 0))
          const upcoming = mapped.filter((m) => m.status !== 'finished').sort((a, b) => (a.ts ?? 0) - (b.ts ?? 0))
          setMatches([...finished, ...upcoming])
        }
        if (active) {
          setRecentRatings(ratingRows.slice(0, 8))
          setRatings(ratingRows)
          setAttributeRatings(attrRows)
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
      try {
        const fp = await supaGet<{ fixture_id: string; player_id: string }[]>('fixture_players?select=fixture_id,player_id')
        if (active) setFixturePlayers(fp)
      } catch { /* fixture_players table not available */ }

      if (active) setLoading(false)
    })()
    return () => {
      active = false
    }
  }, [tick])

  return (
    <DataContext.Provider value={{ players, matches, standings, competitions, recentRatings, ratings, attributeRatings, fixturePlayers, squadRows, fixtureRows, loading, reload }}>
      {children}
    </DataContext.Provider>
  )
}

// ─── Auth (Supabase) ────────────────────────────────────────────────────────

interface AuthUser {
  id: string
  name: string
  email: string
}

interface AuthState {
  user: AuthUser | null
  loading: boolean
  recovery: boolean
  isAdmin: boolean
  signOut: () => void
  endRecovery: () => void
}

const AuthContext = createContext<AuthState>({ user: null, loading: true, recovery: false, isAdmin: false, signOut: () => {}, endRecovery: () => {} })

function useAuth(): AuthState {
  return useContext(AuthContext)
}

function mapAuthUser(session: { user?: { id: string; email?: string; user_metadata?: Record<string, unknown> } } | null): AuthUser | null {
  const u = session?.user
  if (!u) return null
  const metaName = typeof u.user_metadata?.name === 'string' ? (u.user_metadata.name as string) : ''
  const name = metaName || (u.email ? u.email.split('@')[0] : 'Torcedor')
  return { id: u.id, name, email: u.email ?? '' }
}

function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [recovery, setRecovery] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    let active = true
    if (!user) {
      setIsAdmin(false)
      return
    }
    supabase
      .from('admins')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (active) setIsAdmin(Boolean(data))
      })
    return () => {
      active = false
    }
  }, [user])

  useEffect(() => {
    let active = true
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setUser(mapAuthUser(data.session))
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      // Arriving from a password-reset email opens a recovery session.
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
      setUser(mapAuthUser(session))
    })
    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const signOut = (): void => {
    void supabase.auth.signOut()
  }

  const endRecovery = (): void => {
    setRecovery(false)
  }

  return (
    <AuthContext.Provider value={{ user, loading, recovery, isAdmin, signOut, endRecovery }}>
      {children}
    </AuthContext.Provider>
  )
}

// ─── Reset Password Page (from the recovery email link) ─────────────────────

function ResetPasswordPage() {
  const { endRecovery, signOut } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 6) { setError('Mínimo 6 caracteres'); return }
    if (password !== confirm) { setError('Senhas não coincidem'); return }
    setError('')
    setLoading(true)
    const { error: err } = await supabase.auth.updateUser({ password })
    if (err) { setError(err.message); setLoading(false); return }
    setDone(true)
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6" style={{ backgroundColor: '#030910' }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div className="flex justify-center mb-8">
          <JeanScoreLogo width={170} showStars={false} />
        </div>
        {done ? (
          <div className="rounded-2xl p-6 text-center" style={{ background: '#0A1528', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ background: 'linear-gradient(135deg, #003087, #1A5FCC)' }}>
              <CheckCircle size={28} className="text-white" />
            </div>
            <h2 className="font-display font-black text-white mb-2" style={{ fontSize: 20 }}>Senha alterada!</h2>
            <p className="text-sm mb-6" style={{ color: '#5070A0' }}>Sua nova senha já está valendo.</p>
            <button onClick={endRecovery}
              className="w-full py-3 rounded-2xl font-display font-bold text-white text-sm"
              style={{ background: 'linear-gradient(135deg, #003087, #1A5FCC)' }}>
              Continuar
            </button>
          </div>
        ) : (
          <>
            <div className="mb-8 text-center">
              <h2 className="font-display font-black text-white mb-1.5" style={{ fontSize: 26 }}>Nova senha</h2>
              <p className="text-sm" style={{ color: '#5070A0' }}>Defina a nova senha da sua conta</p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <input type="password" placeholder="Nova senha" value={password} onChange={e => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none"
                style={{ background: '#0A1528', border: '1px solid rgba(255,255,255,0.07)', fontFamily: 'Inter, sans-serif' }} />
              <input type="password" placeholder="Confirmar nova senha" value={confirm} onChange={e => setConfirm(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none"
                style={{ background: '#0A1528', border: '1px solid rgba(255,255,255,0.07)', fontFamily: 'Inter, sans-serif' }} />
              {error && <p className="text-xs" style={{ color: '#FF6060' }}>{error}</p>}
              <button type="submit" disabled={loading}
                className="w-full py-3 rounded-2xl font-display font-bold text-white text-sm"
                style={{ background: 'linear-gradient(135deg, #003087, #1A5FCC)', opacity: loading ? 0.6 : 1 }}>
                {loading ? 'Salvando...' : 'Salvar nova senha'}
              </button>
              <button type="button" onClick={() => { signOut(); endRecovery() }}
                className="w-full py-2 text-xs font-semibold" style={{ color: '#5070A0' }}>
                Cancelar
              </button>
            </form>
          </>
        )}
      </div>
    </div>
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
    <img src={cruzeiroLogo} alt="Cruzeiro" width={size} height={size}
      style={{ objectFit: 'contain', display: 'block', userSelect: 'none' }} draggable={false} />
  )
}

/** Team crests (Brasileirão, Libertadores, Sul-Americana opponents). Source: TheSportsDB. */
const TEAM_CRESTS: Record<string, string> = {
  'Palmeiras': 'https://r2.thesportsdb.com/images/media/team/badge/vsqwqp1473538105.png',
  'Flamengo': 'https://r2.thesportsdb.com/images/media/team/badge/syptwx1473538074.png',
  'Athletico-PR': 'https://r2.thesportsdb.com/images/media/team/badge/irzu1u1554237406.png',
  'Atlético-MG': 'https://r2.thesportsdb.com/images/media/team/badge/x5lixs1743742872.png',
  'Bahia': 'https://r2.thesportsdb.com/images/media/team/badge/xuvtsv1473539308.png',
  'RB Bragantino': 'https://r2.thesportsdb.com/images/media/team/badge/2p7tl41701423595.png',
  'Red Bull Bragantino': 'https://r2.thesportsdb.com/images/media/team/badge/2p7tl41701423595.png',
  'Botafogo': 'https://r2.thesportsdb.com/images/media/team/badge/bs5mbw1733004596.png',
  'Corinthians': 'https://r2.thesportsdb.com/images/media/team/badge/vvuvps1473538042.png',
  'Coritiba': 'https://r2.thesportsdb.com/images/media/team/badge/ywwsyu1473538050.png',
  'Chapecoense': 'https://r2.thesportsdb.com/images/media/team/badge/wy0e1i1765900601.png',
  'Fluminense': 'https://r2.thesportsdb.com/images/media/team/badge/stvvwp1473538082.png',
  'Grêmio': 'https://r2.thesportsdb.com/images/media/team/badge/uvpwyt1473538089.png',
  'Internacional': 'https://r2.thesportsdb.com/images/media/team/badge/yprvxx1473538097.png',
  'Mirassol': 'https://r2.thesportsdb.com/images/media/team/badge/pw8uo11765900737.png',
  'Remo': 'https://r2.thesportsdb.com/images/media/team/badge/u36jfy1579341655.png',
  'Santos': 'https://r2.thesportsdb.com/images/media/team/badge/j8xk9g1679447486.png',
  'São Paulo': 'https://r2.thesportsdb.com/images/media/team/badge/sxpupx1473538135.png',
  'Vasco': 'https://r2.thesportsdb.com/images/media/team/badge/ynqlxo1630521109.png',
  'Vasco da Gama': 'https://r2.thesportsdb.com/images/media/team/badge/ynqlxo1630521109.png',
  'Vitória': 'https://r2.thesportsdb.com/images/media/team/badge/tysrrx1473538156.png',
  'América-MG': 'https://r2.thesportsdb.com/images/media/team/badge/rtpp171752177342.png',
  'Goiás': 'https://r2.thesportsdb.com/images/media/team/badge/qhfhdp1635869930.png',
  'Barcelona Guayaquil': 'https://r2.thesportsdb.com/images/media/team/badge/c5yr001653075296.png',
  'Boca Juniors': 'https://r2.thesportsdb.com/images/media/team/badge/bm7krb1775741582.png',
  'Univ. Católica': 'https://r2.thesportsdb.com/images/media/team/badge/h2pcuc1602188028.png',
  'Defensor Sporting': 'https://r2.thesportsdb.com/images/media/team/badge/dx13rd1703003044.png',
  'Tombense': 'https://r2.thesportsdb.com/images/media/team/badge/1uj3n31579340660.png',
  'Uberlândia': 'https://r2.thesportsdb.com/images/media/team/badge/ucyzoq1733810901.png',
  'Betim': 'https://r2.thesportsdb.com/images/media/team/badge/3adbop1769912270.png',
  'Pouso Alegre': 'https://r2.thesportsdb.com/images/media/team/badge/7kazoj1679129032.png',
}

function teamInitials(team: string): string {
  const cleaned = team.replace(/[^0-9A-Za-zÀ-ÿ ]/g, '').trim()
  const parts = cleaned.split(/\s+/).filter(Boolean)
  const ini = parts.length > 1 ? parts.map(w => w[0]).join('') : cleaned
  return (ini || team).slice(0, 3).toUpperCase()
}

/** Renders a team crest image (Cruzeiro uses the local asset); falls back to initials. */
function TeamCrest({ team, size = 32 }: { team: string; size?: number }) {
  if (isCruzeiro(team)) return <CruzeiroCrest size={size} />
  const url = TEAM_CRESTS[team.trim()]
  if (url) {
    return <img src={url} alt={team} width={size} height={size}
      style={{ objectFit: 'contain', display: 'block', userSelect: 'none' }} draggable={false}
      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
  }
  return <span className="font-black text-white/60" style={{ fontSize: Math.max(10, Math.round(size * 0.34)) }}>{teamInitials(team)}</span>
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
          <div className="font-display font-extrabold leading-none" style={{ fontSize: compact ? 24 : 28, color: cfg.accent }}>{player.attrOverall ?? '–'}</div>
          <PosBadge pos={player.pos} />
        </div>
        <div className="flex flex-col items-end gap-1">
          {player.flagCode
            ? <img src={`https://flagcdn.com/w40/${player.flagCode}.png`} alt={player.nat} style={{ width: 22, height: 15, borderRadius: 2, objectFit: 'cover' }} />
            : <span className="text-lg leading-none">{player.flag}</span>}
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

      {/* Name */}
      <div className="px-3 pt-2 pb-1">
        <div className="font-display font-bold text-white truncate" style={{ fontSize: compact ? 10 : 12 }}>{player.short}</div>
      </div>

      {/* Stats row */}
      <div className="flex items-center justify-between px-3 py-2 mx-2 mb-2 rounded-lg" style={{ background: 'rgba(0,0,0,0.38)' }}>
        <div className="flex flex-col">
          <span className="text-[8px] font-bold tracking-wider uppercase" style={{ color: '#5070A0' }}>Nota</span>
          <span className="font-display font-black text-white" style={{ fontSize: 15, lineHeight: 1.1, color: cfg.accent }}>{fmtRating(player.rating)}</span>
        </div>
        <div className="w-px h-6 bg-white opacity-10" />
        <div className="flex flex-col items-end">
          <span className="text-[8px] font-bold tracking-wider uppercase" style={{ color: '#5070A0' }}>Votos</span>
          <span className="font-display font-bold text-white" style={{ fontSize: 13, lineHeight: 1.1 }}>{fmtVotes(player.votes)}</span>
        </div>
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
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden"
        style={{ background: isCruz ? 'linear-gradient(135deg, #003087, #1A5FCC)' : '#101E30', border: '1px solid rgba(255,255,255,0.08)' }}>
        <TeamCrest team={name} size={28} />
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
            <div className="text-[10px] mt-0.5" style={{ color: '#5070A0' }}>Temporada 2026</div>
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
  { id: 'bolao' as Page, icon: Dices, label: 'Bolão Cabuloso' },
]

function Sidebar({ page, setPage }: { page: Page; setPage: (p: Page) => void }) {
  const [expanded, setExpanded] = useState(false)
  const { signOut, isAdmin } = useAuth()
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
        {isAdmin && (
          <button onClick={() => setPage('admin')}
            className="flex items-center gap-3 mx-2 px-2.5 py-2.5 rounded-xl w-[calc(100%-16px)] transition-all duration-150"
            style={{ background: page === 'admin' ? 'rgba(196,151,42,0.12)' : 'transparent' }}>
            <Settings size={16} style={{ flexShrink: 0, color: page === 'admin' ? '#C4972A' : '#2A3A50' }} />
            <span className="text-sm font-medium whitespace-nowrap overflow-hidden"
              style={{ opacity: expanded ? 1 : 0, width: expanded ? 'auto' : 0, color: page === 'admin' ? '#C4972A' : '#3A5070', transition: 'all 0.2s ease' }}>
              Admin
            </span>
          </button>
        )}
        <button onClick={signOut}
          className="flex items-center gap-3 mx-2 px-2.5 py-2.5 rounded-xl w-[calc(100%-16px)] transition-all duration-150"
          style={{ background: 'transparent' }}>
          <LogOut size={16} style={{ flexShrink: 0, color: '#2A3A50' }} />
          <span className="text-sm font-medium whitespace-nowrap overflow-hidden"
            style={{ opacity: expanded ? 1 : 0, width: expanded ? 'auto' : 0, color: '#3A5070', transition: 'all 0.2s ease' }}>
            Sair
          </span>
        </button>
      </div>
    </aside>
  )
}

// ─── Top Bar ──────────────────────────────────────────────────────────────────

function TopBar({ title, onSelectPlayer }: { title: string; onSelectPlayer: (p: Player) => void }) {
  const { user } = useAuth()
  const { players } = useData()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const initial = (user?.name?.trim()?.charAt(0) ?? 'T').toUpperCase()

  const results = q.trim().length > 0
    ? players.filter(p => p.name.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 6)
    : []

  const pick = (p: Player) => {
    onSelectPlayer(p)
    setOpen(false)
    setQ('')
  }

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between px-6 py-3.5"
      style={{ background: 'rgba(3,9,16,0.9)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <h1 className="font-display font-bold text-white" style={{ fontSize: 17 }}>{title}</h1>
      <div className="flex items-center gap-2.5">
        <div className="relative">
          {open ? (
            <div className="flex items-center gap-2 px-3 rounded-xl"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', height: 32 }}>
              <Search size={14} style={{ color: '#5070A0' }} />
              <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar jogador..."
                onBlur={() => setTimeout(() => setOpen(false), 150)}
                className="bg-transparent outline-none text-sm text-white"
                style={{ width: 180, fontFamily: 'Inter, sans-serif' }} />
            </div>
          ) : (
            <button onClick={() => setOpen(true)} className="w-8 h-8 flex items-center justify-center rounded-xl"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <Search size={14} style={{ color: '#5070A0' }} />
            </button>
          )}
          {open && results.length > 0 && (
            <div className="absolute right-0 mt-2 rounded-xl overflow-hidden z-50"
              style={{ width: 250, background: '#0A1528', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 12px 32px rgba(0,0,0,0.5)' }}>
              {results.map((p, i) => (
                <button key={p.id} onMouseDown={() => pick(p)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors"
                  style={{ borderBottom: i < results.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none', background: 'transparent' }}>
                  <div className="w-7 h-7 rounded-lg overflow-hidden flex-shrink-0" style={{ background: RARITY_CFG[p.rarity].photoGrad }}>
                    {p.photo
                      ? <img src={p.photo} alt={p.name} className="w-full h-full object-cover object-top" />
                      : <div className="w-full h-full flex items-center justify-center text-white text-xs font-bold">{p.num}</div>}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-white truncate">{p.name}</div>
                    <div className="text-[10px]" style={{ color: '#5070A0' }}>{p.pos} · #{p.num}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        <div title={user?.name ?? undefined}
          className="w-8 h-8 rounded-xl flex items-center justify-center font-display font-bold text-white text-xs"
          style={{ background: 'linear-gradient(135deg, #003087, #1A5FCC)' }}>{initial}</div>
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
  const { players: PLAYERS, matches: MATCHES, standings, competitions, recentRatings } = useData()
  const topPlayers = [...PLAYERS].sort((a, b) => b.rating - a.rating).slice(0, 5)
  const playerNameById = (dbId: string) => PLAYERS.find(p => p.dbId === dbId)?.name ?? 'Jogador'
  // Hero cards: most recent finished match + next upcoming match.
  const lastMatch = MATCHES.find(m => m.status === 'finished') ?? null
  const lastOpp = lastMatch ? (isCruzeiro(lastMatch.home) ? lastMatch.away : lastMatch.home) : ''
  const lastCruzScore = lastMatch ? (isCruzeiro(lastMatch.home) ? lastMatch.homeScore : lastMatch.awayScore) : 0
  const lastOppScore = lastMatch ? (isCruzeiro(lastMatch.home) ? lastMatch.awayScore : lastMatch.homeScore) : 0
  const lastResult = lastMatch
    ? (lastCruzScore > lastOppScore ? { t: 'VITÓRIA', c: '#22C55E' } : lastCruzScore === lastOppScore ? { t: 'EMPATE', c: '#F59E0B' } : { t: 'DERROTA', c: '#EF4444' })
    : null
  const fmtTime = (ts?: number) => (ts ? new Date(ts * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '')

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

  // Relógio leve para o countdown do bolão no card "Próximo Jogo".
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])
  const bolaoCutoff = nextMatch?.ts ? nextMatch.ts * 1000 - BET_CUTOFF_MS : 0
  const bolaoOpen = bolaoCutoff > now

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
          <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr', maxWidth: 780 }}>
            {/* Último Jogo */}
            <div className="rounded-2xl p-5" style={{ background: 'rgba(5,13,27,0.62)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(8px)' }}>
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: '#5A9FEC' }}>Último Jogo</span>
                {lastMatch && <span className="text-[10px] truncate" style={{ color: 'rgba(255,255,255,0.35)', maxWidth: 130 }}>{lastMatch.comp}</span>}
              </div>
              {lastMatch ? (
                <>
                  <div className="flex items-center justify-center gap-3">
                    <div className="flex flex-col items-center gap-2" style={{ width: 84 }}>
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(0,48,135,0.9), rgba(26,95,204,0.6))', border: '1px solid rgba(26,95,204,0.5)' }}>
                        <CruzeiroCrest size={30} />
                      </div>
                      <span className="font-display font-bold text-white text-center" style={{ fontSize: 12 }}>Cruzeiro</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-display font-black text-white" style={{ fontSize: 40, lineHeight: 1 }}>{lastCruzScore}</span>
                      <span className="font-display font-thin" style={{ fontSize: 24, color: 'rgba(255,255,255,0.25)' }}>:</span>
                      <span className="font-display font-black" style={{ fontSize: 40, lineHeight: 1, color: 'rgba(255,255,255,0.5)' }}>{lastOppScore}</span>
                    </div>
                    <div className="flex flex-col items-center gap-2" style={{ width: 84 }}>
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <TeamCrest team={lastOpp} size={34} />
                      </div>
                      <span className="font-display font-bold text-center" style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>{lastOpp}</span>
                    </div>
                  </div>
                  {lastResult && (
                    <div className="flex justify-center mt-3">
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full" style={{ background: lastResult.c + '20', color: lastResult.c, border: `1px solid ${lastResult.c}40` }}>{lastResult.t}</span>
                    </div>
                  )}
                  {lastMatch.venue && (
                    <div className="flex items-center justify-center gap-1.5 mt-2">
                      <MapPin size={11} style={{ color: 'rgba(255,255,255,0.3)' }} />
                      <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.3)' }}>{lastMatch.venue}</span>
                    </div>
                  )}
                  <div className="flex gap-2 mt-4 justify-center">
                    <button onClick={() => { setSelectedMatch(lastMatch); setPage('match-detail') }}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold"
                      style={{ background: 'linear-gradient(135deg, #003087, #1A5FCC)', color: 'white', boxShadow: '0 4px 16px rgba(26,95,204,0.4)' }}>
                      Ver Partida
                    </button>
                    {lastMatch.liberado && (
                      <button onClick={() => setPage('rate')}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold"
                        style={{ background: 'rgba(196,151,42,0.18)', color: '#E8C840', border: '1px solid rgba(196,151,42,0.3)' }}>
                        <Star size={13} /> Avaliar
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-sm text-center py-8" style={{ color: 'rgba(255,255,255,0.4)' }}>Nenhum jogo realizado ainda.</p>
              )}
            </div>

            {/* Próximo Jogo */}
            <div className="rounded-2xl p-5" style={{ background: 'rgba(5,13,27,0.62)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(8px)' }}>
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: '#E8C840' }}>Próximo Jogo</span>
                {nextMatch && <span className="text-[10px] truncate" style={{ color: 'rgba(255,255,255,0.35)', maxWidth: 130 }}>{nextMatch.comp}</span>}
              </div>
              {nextMatch ? (
                <>
                  <div className="flex items-center justify-center gap-3">
                    <div className="flex flex-col items-center gap-2" style={{ width: 84 }}>
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(0,48,135,0.9), rgba(26,95,204,0.6))', border: '1px solid rgba(26,95,204,0.5)' }}>
                        <CruzeiroCrest size={30} />
                      </div>
                      <span className="font-display font-bold text-white text-center" style={{ fontSize: 12 }}>Cruzeiro</span>
                    </div>
                    <span className="font-display font-black" style={{ fontSize: 26, color: 'rgba(255,255,255,0.85)' }}>VS</span>
                    <div className="flex flex-col items-center gap-2" style={{ width: 84 }}>
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <TeamCrest team={nextOpp} size={34} />
                      </div>
                      <span className="font-display font-bold text-center" style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>{nextOpp}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-center gap-1.5 mt-5">
                    <div className="flex items-center gap-1.5">
                      <Calendar size={12} style={{ color: '#5A9FEC' }} />
                      <span className="text-xs font-semibold text-white">{nextMatch.date}{fmtTime(nextMatch.ts) ? ` · ${fmtTime(nextMatch.ts)}` : ''}</span>
                    </div>
                    {nextMatch.venue && (
                      <div className="flex items-center gap-1.5">
                        <MapPin size={11} style={{ color: 'rgba(255,255,255,0.3)' }} />
                        <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.3)' }}>{nextMatch.venue}</span>
                      </div>
                    )}
                  </div>
                  {bolaoOpen && (
                    <div className="flex flex-col items-center gap-1.5 mt-4">
                      <button onClick={() => setPage('bolao')}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold"
                        style={{ background: 'rgba(196,151,42,0.18)', color: '#E8C840', border: '1px solid rgba(196,151,42,0.3)' }}>
                        <Dices size={13} /> Dar meu palpite
                      </button>
                      <div className="flex items-center gap-1 text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
                        <Clock size={10} />
                        Palpites encerram em {fmtCountdown(bolaoCutoff - now)}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-center py-8" style={{ color: 'rgba(255,255,255,0.4)' }}>Sem jogos futuros agendados.</p>
              )}
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
              <p className="text-xs mt-0.5" style={{ color: '#5070A0' }}>Melhores avaliados · Temporada 2026</p>
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
                        <span className="flex items-center gap-2 min-w-0">
                          <span className="flex-shrink-0 flex items-center justify-center" style={{ width: 20, height: 20 }}>
                            <TeamCrest team={row.team} size={20} />
                          </span>
                          <span className="font-display font-semibold truncate" style={{ fontSize: 13, color: row.is_cruzeiro ? 'white' : '#8098B0' }}>{row.team}</span>
                        </span>
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

          {/* Upcoming matches */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-bold text-white" style={{ fontSize: 16 }}>Próximas Partidas</h2>
              <button onClick={() => setPage('matches')} className="text-xs font-semibold" style={{ color: '#4A8EE8' }}>Ver todas</button>
            </div>
            <div className="space-y-3">
              {MATCHES.filter(m => m.status === 'upcoming').slice(0, 3).map(m => (
                <MatchCard key={m.id} match={m} onClick={() => { setSelectedMatch(m); setPage('match-detail') }} />
              ))}
              {MATCHES.filter(m => m.status === 'upcoming').length === 0 && (
                <div className="rounded-2xl px-5 py-8 text-center" style={{ background: '#0A1528', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <span className="text-sm" style={{ color: '#5070A0' }}>Sem jogos futuros agendados</span>
                </div>
              )}
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
          {recentRatings.length > 0 ? (
            <div className="space-y-2">
              {recentRatings.map(r => {
                const acc = RARITY_CFG[rarityFromRating(Number(r.score))].accent
                return (
                  <div key={r.id} className="flex items-start gap-3 rounded-2xl px-4 py-3.5"
                    style={{ background: '#0A1528', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center font-display font-black text-xs text-white"
                      style={{ background: 'linear-gradient(135deg, #003087, #1A5FCC)' }}>
                      {r.user_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold" style={{ color: '#8098B0' }}>{r.user_name}</span>
                        <span className="text-xs" style={{ color: '#3A5070' }}>avaliou</span>
                        <span className="text-xs font-semibold text-white">{playerNameById(r.player_id)}</span>
                        <span className="px-1.5 py-0.5 rounded text-xs font-black" style={{ background: acc + '20', color: acc }}>{Number(r.score).toFixed(1)}</span>
                        <span className="text-xs ml-auto" style={{ color: '#2A3A50' }}>{timeAgo(r.created_at)}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
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
          )}
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
          <span className="text-xs font-bold tracking-widest uppercase" style={{ color: '#C4972A' }}>Temporada 2026</span>
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
          Elenco <span style={{ background: 'linear-gradient(90deg, #4A8EE8, #1A5FCC)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>2026</span>
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
  const [attrVote, setAttrVote] = useState<Record<string, number>>({})
  const [attrSaving, setAttrSaving] = useState(false)
  const { ratings, matches, attributeRatings, reload } = useData()
  const { user } = useAuth()

  const oppOf = (m: Match) => (isCruzeiro(m.home) ? m.away : m.home)
  const resultLabel = (m: Match) => {
    const cruzHome = isCruzeiro(m.home)
    const cs = cruzHome ? m.homeScore : m.awayScore
    const os = cruzHome ? m.awayScore : m.homeScore
    const tag = cs > os ? 'V' : cs === os ? 'E' : 'D'
    return `${tag} ${cs}–${os}`
  }

  // Real per-match ratings for this player, oldest → newest.
  const perMatch = (() => {
    if (!player.dbId) return [] as { avg: number; n: number; match: Match; label: string }[]
    const byFixture = new Map<string, { sum: number; n: number }>()
    for (const r of ratings) {
      if (r.player_id !== player.dbId) continue
      const a = byFixture.get(r.fixture_id) ?? { sum: 0, n: 0 }
      a.sum += Number(r.score)
      a.n += 1
      byFixture.set(r.fixture_id, a)
    }
    return [...byFixture.entries()]
      .map(([fid, a]) => {
        const m = matches.find(mm => mm.dbId === fid)
        return m ? { avg: Math.round((a.sum / a.n) * 10) / 10, n: a.n, match: m, label: oppOf(m).slice(0, 3).toUpperCase() } : null
      })
      .filter((x): x is { avg: number; n: number; match: Match; label: string } => x !== null)
      .sort((a, b) => (a.match.ts ?? 0) - (b.match.ts ?? 0))
  })()
  const hasHistory = perMatch.length > 0
  const bestMatch = hasHistory ? perMatch.reduce((b, x) => (x.avg > b.avg ? x : b)) : null
  const worstMatch = hasHistory ? perMatch.reduce((w, x) => (x.avg < w.avg ? x : w)) : null
  const historyData = perMatch.map(x => ({ m: x.label, r: x.avg }))

  // Community-voted attributes (0–99), averaged from attribute_ratings.
  const attrLabels = attributesFor(player.pos)
  const attrAvgMap = (() => {
    const map = new Map<string, { sum: number; n: number }>()
    for (const a of attributeRatings) {
      if (a.player_id !== player.dbId) continue
      const x = map.get(a.attribute) ?? { sum: 0, n: 0 }
      x.sum += Number(a.score)
      x.n += 1
      map.set(a.attribute, x)
    }
    return map
  })()
  const attrs = attrLabels.map(label => {
    const x = attrAvgMap.get(label)
    return { label, v: x && x.n > 0 ? Math.round(x.sum / x.n) : null }
  })
  const attrVoters = new Set(
    attributeRatings.filter(a => a.player_id === player.dbId).map(a => a.user_id),
  ).size
  const userVotedAttrs = !!user && attributeRatings.some(a => a.player_id === player.dbId && a.user_id === user.id)

  const submitAttributes = async () => {
    if (!user || !player.dbId) return
    setAttrSaving(true)
    const rows = attrLabels.map(label => ({
      user_id: user.id,
      player_id: player.dbId as string,
      attribute: label,
      score: attrVote[label] ?? 50,
    }))
    const { error } = await supabase.from('attribute_ratings').upsert(rows, { onConflict: 'user_id,player_id,attribute' })
    setAttrSaving(false)
    if (error) { console.error('Falha ao enviar atributos', error); alert('Não foi possível enviar os atributos.') }
    else reload()
  }

  const keyStats: { label: string; value: string | number; icon: string }[] = [
    { label: 'Nota média', value: fmtRating(player.rating), icon: '⭐' },
    { label: 'Partidas avaliadas', value: perMatch.length, icon: '📅' },
    { label: 'Overall', value: player.attrOverall ?? '–', icon: '🎯' },
  ]

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
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-display font-bold text-white" style={{ fontSize: 14 }}>Atributos do Jogador</h3>
                <span className="text-[10px]" style={{ color: '#5070A0' }}>{attrVoters} {attrVoters === 1 ? 'voto' : 'votos'}</span>
              </div>

              {userVotedAttrs ? (
                <>
                  {attrs.map(({ label, v }) => (
                    <div key={label} className="mb-3.5">
                      <div className="flex justify-between text-xs mb-1.5">
                        <span style={{ color: '#7090B0' }}>{label}</span>
                        <span className="font-bold" style={{ color: cfg.accent }}>{v ?? '–'}</span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                        <div className="h-full rounded-full" style={{ width: `${v ?? 0}%`, background: `linear-gradient(90deg, ${cfg.accent}70, ${cfg.accent})`, transition: 'width 0.8s ease' }} />
                      </div>
                    </div>
                  ))}
                  <p className="text-[11px] mt-1" style={{ color: '#3A5070' }}>Você já votou nos atributos deste jogador. Acima está a média da torcida.</p>
                </>
              ) : (
                <>
                  <p className="text-xs mb-4" style={{ color: '#5070A0' }}>Dê sua nota (0–99) para cada atributo. Você pode votar uma vez.</p>
                  {attrLabels.map(label => {
                    const val = attrVote[label] ?? 50
                    return (
                      <div key={label} className="mb-3.5">
                        <div className="flex justify-between text-xs mb-1.5">
                          <span style={{ color: '#7090B0' }}>{label}</span>
                          <span className="font-bold" style={{ color: cfg.accent }}>{val}</span>
                        </div>
                        <input type="range" min={0} max={99} value={val}
                          onChange={e => setAttrVote(prev => ({ ...prev, [label]: Number(e.target.value) }))}
                          className="w-full" style={{ accentColor: cfg.accent }} />
                      </div>
                    )
                  })}
                  <button onClick={submitAttributes} disabled={attrSaving}
                    className="w-full mt-2 py-3 rounded-xl font-display font-bold text-white text-sm"
                    style={{ background: 'linear-gradient(135deg, #003087, #1A5FCC)', opacity: attrSaving ? 0.6 : 1 }}>
                    {attrSaving ? 'Enviando...' : 'Enviar atributos'}
                  </button>
                </>
              )}
            </div>

            {/* Best / worst match (real, from votes) */}
            {hasHistory && bestMatch && worstMatch ? (
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Melhor Partida', item: bestMatch, color: '#22C55E' },
                  { label: 'Pior Partida', item: worstMatch, color: '#EF4444' },
                ].map(({ label, item, color }) => (
                  <div key={label} className="rounded-2xl p-4"
                    style={{ background: '#0A1528', border: `1px solid ${color}25` }}>
                    <div className="text-[10px] font-bold tracking-widest uppercase mb-2" style={{ color: color + '80' }}>{label}</div>
                    <div className="font-display font-black text-white" style={{ fontSize: 11, marginBottom: 4 }}>vs {oppOf(item.match)}</div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: color + '15', color }}>{resultLabel(item.match)}</span>
                      <span className="font-display font-black" style={{ fontSize: 20, color }}>{item.avg.toFixed(1)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl p-5 text-center" style={{ background: '#0A1528', border: '1px solid rgba(255,255,255,0.06)' }}>
                <p className="text-xs" style={{ color: '#5070A0' }}>Sem avaliações de partidas ainda para este jogador.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          hasHistory ? (
            <div className="space-y-5">
              <div className="rounded-2xl p-5" style={{ background: '#0A1528', border: '1px solid rgba(255,255,255,0.06)' }}>
                <h3 className="font-display font-bold text-white mb-4" style={{ fontSize: 14 }}>Evolução da Nota</h3>
                <div style={{ height: 180 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={historyData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id={`rg-${player.id}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={cfg.accent} stopOpacity={0.35} />
                          <stop offset="95%" stopColor={cfg.accent} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                      <XAxis dataKey="m" tick={{ fill: '#5070A0', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis domain={[0, 10]} tick={{ fill: '#5070A0', fontSize: 10 }} axisLine={false} tickLine={false} />
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
                {[...perMatch].reverse().slice(0, 8).map((x, i) => {
                  const high = x.avg >= 8
                  const mid = x.avg >= 6.5 && x.avg < 8
                  const rColor = high ? '#22C55E' : mid ? '#F59E0B' : '#EF4444'
                  return (
                    <div key={i} className="flex items-center gap-4 px-4 py-3 rounded-xl"
                      style={{ background: '#0A1528', border: '1px solid rgba(255,255,255,0.04)' }}>
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs"
                        style={{ background: 'rgba(26,95,204,0.15)', color: '#4A8EE8' }}>vs</div>
                      <div className="flex-1 min-w-0">
                        <span className="font-display font-bold text-white text-sm">{oppOf(x.match)}</span>
                        <div className="text-[10px]" style={{ color: '#3A5070' }}>{resultLabel(x.match)} · {x.n} {x.n === 1 ? 'voto' : 'votos'}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        {high ? <TrendingUp size={12} className="text-emerald-400" /> : mid ? <Minus size={12} className="text-yellow-400" /> : <TrendingDown size={12} className="text-red-400" />}
                        <span className="font-display font-black" style={{ fontSize: 18, color: rColor }}>{x.avg.toFixed(1)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl p-8 text-center" style={{ background: '#0A1528', border: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="text-sm" style={{ color: '#5070A0' }}>Este jogador ainda não recebeu avaliações em nenhuma partida.</p>
            </div>
          )
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
  const { players: PLAYERS, ratings, fixturePlayers, fixtureRows } = useData()
  const { user } = useAuth()
  const [tab, setTab] = useState<'lineup' | 'stats' | 'bolao'>('lineup')
  const [preds, setPreds] = useState<DbPredictionRow[]>([])
  const [predQuery, setPredQuery] = useState('')

  // Palpites do bolão desta partida.
  useEffect(() => {
    if (!match.dbId) return
    supaGet<DbPredictionRow[]>(`predictions?select=id,user_id,user_name,fixture_id,home_pred,away_pred&fixture_id=eq.${match.dbId}`)
      .then(setPreds)
      .catch(() => { /* tabela ainda não criada */ })
  }, [match.dbId])
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
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center overflow-hidden"
                style={{ background: isCruzeiro(match.home) ? 'linear-gradient(135deg, #003087, #1A5FCC)' : 'rgba(255,255,255,0.08)' }}>
                <TeamCrest team={match.home} size={44} />
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
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center overflow-hidden"
                style={{ background: isCruzeiro(match.away) ? 'linear-gradient(135deg, #003087, #1A5FCC)' : 'rgba(255,255,255,0.08)' }}>
                <TeamCrest team={match.away} size={44} />
              </div>
              <span className="font-display font-bold text-white text-center" style={{ fontSize: 14, maxWidth: 100 }}>{match.away}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="px-6">
        <div className="flex gap-1 p-1 rounded-2xl mb-6" style={{ background: '#0A1528' }}>
          {(['lineup', 'stats', 'bolao'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150"
              style={{ background: tab === t ? '#003087' : 'transparent', color: tab === t ? 'white' : '#5070A0' }}>
              {t === 'lineup' ? 'Escalação' : t === 'stats' ? 'Estatísticas' : 'Bolão Cabuloso'}
            </button>
          ))}
        </div>

        {tab === 'lineup' && (
          (() => {
            // Average rating per player for THIS match only.
            const byPlayer = new Map<string, { sum: number; n: number }>()
            if (match.dbId) {
              for (const r of ratings) {
                if (r.fixture_id !== match.dbId) continue
                const a = byPlayer.get(r.player_id) ?? { sum: 0, n: 0 }
                a.sum += Number(r.score)
                a.n += 1
                byPlayer.set(r.player_id, a)
              }
            }
            // Only the players selected for this match (fixture_players). If no lineup
            // was saved, fall back to the players who received votes in this match.
            const selectedIds = new Set(fixturePlayers.filter(fp => fp.fixture_id === match.dbId).map(fp => fp.player_id))
            const played = (id: string) => selectedIds.size > 0 ? selectedIds.has(id) : byPlayer.has(id)
            const lineup = PLAYERS
              .filter(p => p.dbId && played(p.dbId))
              .map(p => {
                const agg = p.dbId ? byPlayer.get(p.dbId) : undefined
                return { p, avg: agg ? agg.sum / agg.n : null, n: agg?.n ?? 0 }
              })
              .sort((a, b) => (b.avg ?? -1) - (a.avg ?? -1))
            if (lineup.length === 0) {
              return (
                <div className="rounded-2xl px-6 py-10 text-center" style={{ background: '#0A1528', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <p className="text-sm" style={{ color: '#5070A0' }}>Escalação ainda não cadastrada para esta partida.</p>
                </div>
              )
            }
            return (
              <div>
                <div className="mb-4">
                  <h3 className="font-display font-bold text-white" style={{ fontSize: 14 }}>Cruzeiro — Avaliações</h3>
                  <p className="text-xs mt-0.5" style={{ color: '#3A5070' }}>Média da torcida nesta partida</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {lineup.map(({ p, avg, n }) => {
                    const rColor = avg == null ? '#3A5070' : avg >= 8 ? '#22C55E' : avg >= 6.5 ? '#F59E0B' : '#EF4444'
                    return (
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
                          <div className="flex items-center gap-1.5">
                            <PosBadge pos={p.pos} />
                            {n > 0 && <span className="text-[9px]" style={{ color: '#3A5070' }}>{n} {n === 1 ? 'voto' : 'votos'}</span>}
                          </div>
                        </div>
                        <span className="font-display font-black" style={{ fontSize: 15, color: rColor }}>{avg != null ? avg.toFixed(1) : '—'}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })()
        )}

        {tab === 'stats' && (
          (() => {
            const rows = STAT_FIELDS
              .map(f => ({ ...f, ...(match.stats?.[f.key] ?? { home: null, away: null }) }))
              .filter(r => r.home != null || r.away != null)
            if (rows.length === 0) {
              return (
                <div className="rounded-2xl px-6 py-10 text-center" style={{ background: '#0A1528', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <p className="text-sm" style={{ color: '#5070A0' }}>Estatísticas ainda não cadastradas para esta partida.</p>
                </div>
              )
            }
            return (
              <div className="space-y-2.5">
                {rows.map(({ label, home, away, unit }) => {
                  const h = home ?? 0, a = away ?? 0
                  const total = h + a
                  const homePct = total > 0 ? Math.round((h / total) * 100) : 50
                  return (
                    <div key={label} className="rounded-xl px-4 py-3" style={{ background: '#0A1528' }}>
                      <div className="flex justify-between text-xs mb-2">
                        <span className="font-bold text-white">{h}{unit}</span>
                        <span style={{ color: '#5070A0' }}>{label}</span>
                        <span className="font-bold" style={{ color: '#5070A0' }}>{a}{unit}</span>
                      </div>
                      <div className="flex h-1.5 rounded-full overflow-hidden gap-0.5">
                        <div className="rounded-l-full" style={{ width: `${homePct}%`, background: 'linear-gradient(90deg, #1A5FCC, #4A8EE8)' }} />
                        <div className="rounded-r-full flex-1" style={{ background: 'rgba(255,255,255,0.08)' }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })()
        )}

        {tab === 'bolao' && (
          (() => {
            // Placar final real (só vale se o jogo já começou e o placar foi preenchido).
            const row = fixtureRows.find(f => f.id === match.dbId)
            const kicked = (match.ts ?? 0) * 1000 <= Date.now()
            const final = kicked && row && row.home_score != null && row.away_score != null
              ? { hs: row.home_score, as: row.away_score } : null

            const myPred = preds.find(p => p.user_id === user?.id) ?? null
            const others = preds
              .filter(p => p.user_id !== user?.id)
              .filter(p => p.user_name.toLowerCase().includes(predQuery.trim().toLowerCase()))
              .map(p => ({ p, pts: final ? predictionPoints(p.home_pred, p.away_pred, final.hs, final.as) : null }))
              .sort((a, b) => (b.pts ?? -1) - (a.pts ?? -1) || a.p.user_name.localeCompare(b.p.user_name))

            const ptsColor = (pts: number) => pts === 3 ? '#22C55E' : pts === 2 ? '#4A8EE8' : pts === 1 ? '#F59E0B' : '#EF4444'
            const PtsBadge = ({ pts }: { pts: number }) => (
              <span className="font-display font-black" style={{ fontSize: 15, color: ptsColor(pts) }}>
                +{pts} <span className="text-[10px] font-bold" style={{ color: '#3A5070' }}>pts</span>
              </span>
            )

            return (
              <div>
                {/* Meu Palpite */}
                <h3 className="font-display font-bold text-white mb-3" style={{ fontSize: 14 }}>Meu Palpite</h3>
                {myPred ? (
                  <div className="rounded-2xl px-5 py-4 mb-6 flex items-center justify-between"
                    style={{ background: 'linear-gradient(135deg, rgba(0,48,135,0.35), rgba(26,95,204,0.12))', border: '1px solid rgba(26,95,204,0.3)' }}>
                    <div className="flex items-center gap-4">
                      <Dices size={18} style={{ color: '#4A8EE8' }} />
                      <div>
                        <div className="font-display font-black text-white" style={{ fontSize: 24, lineHeight: 1 }}>
                          {myPred.home_pred} <span style={{ color: 'rgba(255,255,255,0.25)', fontWeight: 300 }}>×</span> {myPred.away_pred}
                        </div>
                        <div className="text-[10px] mt-1" style={{ color: '#5070A0' }}>{match.home} × {match.away}</div>
                      </div>
                    </div>
                    {final ? (
                      <PtsBadge pts={predictionPoints(myPred.home_pred, myPred.away_pred, final.hs, final.as)} />
                    ) : (
                      <span className="text-[10px] font-semibold px-2 py-1 rounded-full" style={{ background: 'rgba(26,95,204,0.15)', color: '#4A8EE8' }}>aguardando resultado</span>
                    )}
                  </div>
                ) : (
                  <div className="rounded-2xl px-5 py-5 mb-6 text-center" style={{ background: '#0A1528', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <p className="text-sm" style={{ color: '#5070A0' }}>
                      Você não deixou palpite para esta partida{kicked ? '.' : ' — ainda dá tempo! Vá na aba Bolão Cabuloso do menu.'}
                    </p>
                  </div>
                )}

                {/* Palpites da torcida + busca */}
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-display font-bold text-white" style={{ fontSize: 14 }}>Palpites da Torcida</h3>
                  <span className="text-[10px]" style={{ color: '#3A5070' }}>{preds.length} {preds.length === 1 ? 'palpite' : 'palpites'}</span>
                </div>
                <div className="relative mb-3">
                  <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: '#3A5070' }} />
                  <input value={predQuery} onChange={e => setPredQuery(e.target.value)}
                    placeholder="Buscar torcedor..."
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none text-white"
                    style={{ background: '#0A1528', border: '1px solid rgba(255,255,255,0.07)' }} />
                </div>
                {others.length === 0 ? (
                  <div className="rounded-2xl px-6 py-8 text-center" style={{ background: '#0A1528', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <p className="text-sm" style={{ color: '#5070A0' }}>
                      {preds.length === 0 ? 'Ainda não há palpites para esta partida.'
                        : predQuery.trim() ? 'Nenhum torcedor encontrado com esse nome.'
                        : 'Nenhum outro torcedor palpitou ainda.'}
                    </p>
                  </div>
                ) : (
                  <div className="rounded-2xl overflow-hidden" style={{ background: '#0A1528', border: '1px solid rgba(255,255,255,0.06)' }}>
                    {others.map(({ p, pts }, i) => (
                      <div key={p.id} className="flex items-center gap-3 px-4 py-3"
                        style={{ borderBottom: i < others.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                        <div className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-[11px] flex-shrink-0"
                          style={{ background: 'rgba(26,95,204,0.18)', color: '#4A8EE8' }}>
                          {p.user_name.charAt(0).toUpperCase()}
                        </div>
                        <span className="flex-1 min-w-0 text-sm font-semibold text-white truncate">{p.user_name}</span>
                        <span className="font-display font-black text-white" style={{ fontSize: 16 }}>
                          {p.home_pred} <span style={{ color: 'rgba(255,255,255,0.25)', fontWeight: 300 }}>×</span> {p.away_pred}
                        </span>
                        {pts != null && <div className="w-14 text-right"><PtsBadge pts={pts} /></div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })()
        )}
      </div>
    </div>
  )
}

// ─── Rating Page ──────────────────────────────────────────────────────────────

function RatingPage() {
  const { players: allPlayers, matches: MATCHES, reload, fixturePlayers } = useData()
  const { user } = useAuth()
  const votingMatch = MATCHES.find(m => m.liberado) ?? null
  const selectedIds = new Set(fixturePlayers.filter(fp => fp.fixture_id === votingMatch?.dbId).map(fp => fp.player_id))
  // Only the players selected for this match are votable; otherwise the whole squad.
  const PLAYERS = selectedIds.size > 0 ? allPlayers.filter(p => p.dbId && selectedIds.has(p.dbId)) : allPlayers
  const [currentIdx, setCurrentIdx] = useState(0)
  const [ratings, setRatings] = useState<Record<number, number>>({})
  const [hoveredRating, setHoveredRating] = useState<number | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [flash, setFlash] = useState(false)
  const [prevScores, setPrevScores] = useState<Record<string, number>>({})
  const seededRef = useRef<string | null>(null)

  // Load this user's previous notes for the open match, so they can see what
  // they already gave (and are about to overwrite). Also pre-fills the selectors.
  useEffect(() => {
    if (!user || !votingMatch?.dbId) return
    if (seededRef.current === votingMatch.dbId) return
    let active = true
    supabase.from('ratings').select('player_id,score').eq('user_id', user.id).eq('fixture_id', votingMatch.dbId)
      .then(({ data }) => {
        if (!active || !data) return
        seededRef.current = votingMatch.dbId ?? null
        const byDbId: Record<string, number> = {}
        const seed: Record<number, number> = {}
        for (const row of data as { player_id: string; score: number }[]) {
          byDbId[row.player_id] = Number(row.score)
          const pl = allPlayers.find(p => p.dbId === row.player_id)
          if (pl) seed[pl.id] = Number(row.score)
        }
        setPrevScores(byDbId)
        // Merge: seeded previous notes first, current-session picks win.
        setRatings(prev => ({ ...seed, ...prev }))
      })
    return () => { active = false }
  }, [user, votingMatch?.dbId, allPlayers])

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

  const handleSubmit = async () => {
    if (user && votingMatch?.dbId) {
      // Re-read the user's existing notes for THIS match at submit time. This makes
      // saving independent of the async pre-load: a fast submit (before pre-load
      // finishes) can no longer wipe untouched players back to 5.0.
      const { data: existing } = await supabase.from('ratings')
        .select('player_id,score').eq('user_id', user.id).eq('fixture_id', votingMatch.dbId)
      const dbNotes: Record<string, number> = {}
      for (const row of (existing ?? []) as { player_id: string; score: number }[]) {
        dbNotes[row.player_id] = Number(row.score)
      }
      // Priority per player: value chosen this session > existing DB note > 5.0.
      const rows = PLAYERS.filter(p => p.dbId).map(p => {
        const dbId = p.dbId as string
        return {
          user_id: user.id,
          user_name: user.name,
          player_id: dbId,
          fixture_id: votingMatch.dbId as string,
          score: ratings[p.id] ?? dbNotes[dbId] ?? 5,
        }
      })
      const { error } = await supabase.from('ratings').upsert(rows, { onConflict: 'user_id,player_id,fixture_id' })
      if (error) { console.error('Falha ao salvar avaliações', error) }
      else {
        const finalLocal: Record<number, number> = {}
        PLAYERS.forEach(p => { if (p.dbId) finalLocal[p.id] = ratings[p.id] ?? dbNotes[p.dbId] ?? 5 })
        setRatings(finalLocal)
        reload()
      }
    }
    setSubmitted(true)
  }

  if (!votingMatch) {
    return (
      <div className="flex flex-col items-center justify-center px-6 text-center" style={{ minHeight: 'calc(100vh - 60px)' }}>
        <div className="w-16 h-16 rounded-full flex items-center justify-center mb-5"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <Vote size={28} style={{ color: '#3A5070' }} />
        </div>
        <h2 className="font-display font-black text-white mb-2" style={{ fontSize: 22 }}>Votação fechada</h2>
        <p className="text-sm" style={{ color: '#5070A0', maxWidth: 340 }}>
          Nenhum jogo está liberado para avaliação no momento. Volte quando o próximo jogo for liberado.
        </p>
      </div>
    )
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
        <button onClick={() => { setSubmitted(false); setCurrentIdx(0); setRatings({}); seededRef.current = null }}
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
            <p className="text-xs mt-0.5" style={{ color: '#5070A0' }}>{votingMatch ? `${votingMatch.home} × ${votingMatch.away} · ${votingMatch.date}` : 'Nenhum jogo liberado para votação'}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-display font-bold" style={{ color: '#3A5070', fontSize: 13 }}>{Object.keys(ratings).length}/{PLAYERS.length} avaliados</span>
          </div>
        </div>
        <div className="h-0.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #003087, #4A8EE8)' }} />
        </div>
        {Object.keys(prevScores).length > 0 && (
          <div className="mt-3 rounded-xl px-4 py-2.5" style={{ background: 'rgba(196,151,42,0.10)', border: '1px solid rgba(196,151,42,0.25)' }}>
            <span className="text-[12px]" style={{ color: '#C4972A' }}>
              Você já avaliou esta partida. Suas notas anteriores estão carregadas abaixo — enviar de novo vai <strong>sobrescrevê-las</strong>.
            </span>
          </div>
        )}
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

            {player.dbId && prevScores[player.dbId] !== undefined && (
              <p className="text-center text-[11px] mt-1.5" style={{ color: '#C4972A' }}>
                Sua nota anterior para {player.short}: <strong>{prevScores[player.dbId].toFixed(1)}</strong>
              </p>
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

// ─── Bolão Cabuloso ───────────────────────────────────────────────────────────

interface DbPredictionRow {
  id: string
  user_id: string
  user_name: string
  fixture_id: string
  home_pred: number
  away_pred: number
}

/** Palpites fecham 1 minuto antes do início da partida. */
const BET_CUTOFF_MS = 60_000

/** Pontuação do bolão: 3 placar exato · 2 vencedor + saldo · 1 só vencedor/empate · 0 erro. */
function predictionPoints(hp: number, ap: number, hs: number, as: number): number {
  if (hp === hs && ap === as) return 3
  const sign = (x: number) => (x > 0 ? 1 : x < 0 ? -1 : 0)
  if (sign(hp - ap) !== sign(hs - as)) return 0
  return hp - ap === hs - as ? 2 : 1
}

function fmtCountdown(ms: number): string {
  const min = Math.floor(ms / 60000)
  if (min < 1) return 'menos de 1min'
  if (min < 60) return `${min}min`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}h${min % 60 > 0 ? ` ${min % 60}min` : ''}`
  const d = Math.floor(h / 24)
  return `${d}d ${h % 24}h`
}

/** Stepper de gols (0–20) usado no palpite. */
function ScoreStepper({ value, onChange, disabled }: { value: number; onChange: (v: number) => void; disabled?: boolean }) {
  const btn = 'w-9 h-9 rounded-xl font-display font-black text-lg flex items-center justify-center transition-all duration-100 select-none'
  return (
    <div className="flex flex-col items-center gap-2">
      <button type="button" disabled={disabled || value >= 20} onClick={() => onChange(value + 1)}
        className={btn} style={{ background: 'rgba(26,95,204,0.2)', color: '#4A8EE8', opacity: disabled ? 0.35 : 1 }}>+</button>
      <span className="font-display font-black text-white" style={{ fontSize: 44, lineHeight: 1, minWidth: 56, textAlign: 'center' }}>{value}</span>
      <button type="button" disabled={disabled || value <= 0} onClick={() => onChange(value - 1)}
        className={btn} style={{ background: 'rgba(255,255,255,0.06)', color: '#5070A0', opacity: disabled ? 0.35 : 1 }}>−</button>
    </div>
  )
}

function BolaoPage() {
  const { matches: MATCHES, fixtureRows, ratings } = useData()
  const { user } = useAuth()
  const [predictions, setPredictions] = useState<DbPredictionRow[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [homePred, setHomePred] = useState(0)
  const [awayPred, setAwayPred] = useState(0)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [now, setNow] = useState(Date.now())

  // Relógio leve para o countdown e para travar o formulário no horário certo.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000)
    return () => clearInterval(t)
  }, [])

  const loadPredictions = () => {
    supaGet<DbPredictionRow[]>('predictions?select=id,user_id,user_name,fixture_id,home_pred,away_pred')
      .then(setPredictions)
      .catch(() => { /* tabela ainda não criada */ })
  }
  useEffect(loadPredictions, [])

  const cutoffOf = (m: Match) => (m.ts ?? 0) * 1000 - BET_CUTOFF_MS
  // Partidas abertas para palpite: ainda não iniciadas e antes do corte de 1 min.
  const openMatches = MATCHES
    .filter(m => m.dbId && m.ts && cutoffOf(m) > now)
    .sort((a, b) => (a.ts ?? 0) - (b.ts ?? 0))

  const selected = openMatches.find(m => m.dbId === selectedId) ?? openMatches[0] ?? null
  const myPrediction = selected ? predictions.find(p => p.user_id === user?.id && p.fixture_id === selected.dbId) : undefined

  // Ao trocar de partida (ou carregar palpites), semeia o formulário com o palpite existente.
  useEffect(() => {
    setHomePred(myPrediction?.home_pred ?? 0)
    setAwayPred(myPrediction?.away_pred ?? 0)
    setMsg(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.dbId, myPrediction?.id])

  const submit = async () => {
    if (!user || !selected?.dbId) return
    if (cutoffOf(selected) <= Date.now()) {
      setMsg({ kind: 'err', text: 'Palpites encerrados para esta partida (fecham 1 min antes do início).' })
      return
    }
    setSaving(true)
    const { error } = await supabase.from('predictions').upsert({
      user_id: user.id,
      user_name: user.name,
      fixture_id: selected.dbId,
      home_pred: homePred,
      away_pred: awayPred,
    }, { onConflict: 'user_id,fixture_id' })
    setSaving(false)
    if (error) {
      console.error('Falha ao salvar palpite', error)
      setMsg({ kind: 'err', text: 'Não foi possível salvar. Os palpites fecham 1 min antes do jogo.' })
    } else {
      setMsg({ kind: 'ok', text: myPrediction ? 'Palpite atualizado!' : 'Palpite registrado! Você pode ajustar até 1 min antes do início.' })
      loadPredictions()
    }
  }

  // Placares finais reais (só jogos já iniciados e com placar preenchido no banco).
  const finals = new Map<string, { hs: number; as: number }>()
  for (const f of fixtureRows) {
    if (f.home_score == null || f.away_score == null) continue
    if ((f.ts ? f.ts * 1000 : new Date(f.fixture_date).getTime()) > now) continue
    finals.set(f.id, { hs: f.home_score, as: f.away_score })
  }

  // Ranking geral: soma de pontos por usuário nos jogos encerrados.
  const board = new Map<string, { name: string; pts: number; exact: number; n: number }>()
  for (const p of predictions) {
    const fin = finals.get(p.fixture_id)
    if (!fin) continue
    const pts = predictionPoints(p.home_pred, p.away_pred, fin.hs, fin.as)
    const row = board.get(p.user_id) ?? { name: p.user_name, pts: 0, exact: 0, n: 0 }
    row.pts += pts
    row.n += 1
    if (pts === 3) row.exact += 1
    board.set(p.user_id, row)
  }
  // Desempate: 1) mais placares exatos · 2) mais votos (avaliações) na plataforma.
  const votesBy = new Map<string, number>()
  for (const r of ratings) votesBy.set(r.user_id, (votesBy.get(r.user_id) ?? 0) + 1)
  const ranking = [...board.entries()]
    .map(([uid, r]) => ({ uid, ...r, votes: votesBy.get(uid) ?? 0 }))
    .sort((a, b) => b.pts - a.pts || b.exact - a.exact || b.votes - a.votes || a.name.localeCompare(b.name))

  // Meus palpites (mais recentes primeiro), com pontos quando o jogo já encerrou.
  const mine = predictions
    .filter(p => p.user_id === user?.id)
    .map(p => ({ p, match: MATCHES.find(m => m.dbId === p.fixture_id) ?? null, fin: finals.get(p.fixture_id) ?? null }))
    .sort((a, b) => (b.match?.ts ?? 0) - (a.match?.ts ?? 0))

  const ptsColor = (pts: number) => pts === 3 ? '#22C55E' : pts === 2 ? '#4A8EE8' : pts === 1 ? '#F59E0B' : '#EF4444'

  return (
    <div className="px-6 lg:px-10 py-6 pb-16 max-w-6xl">
      {/* Regras */}
      <div className="rounded-2xl p-5 mb-6" style={{ background: 'linear-gradient(135deg, rgba(0,48,135,0.35), rgba(26,95,204,0.12))', border: '1px solid rgba(26,95,204,0.25)' }}>
        <div className="flex items-center gap-2 mb-3">
          <Dices size={18} style={{ color: '#4A8EE8' }} />
          <h2 className="font-display font-black text-white" style={{ fontSize: 18 }}>Bolão Cabuloso</h2>
        </div>
        <p className="text-xs mb-4" style={{ color: '#7090B0' }}>
          Deixe seu palpite de placar para as próximas partidas. Um palpite por jogo, e ele pode ser
          ajustado até 1 minuto antes da bola rolar.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {[
            { pts: 3, label: 'Placar exato', ex: 'Apostou 2×1, deu 2×1', color: '#22C55E' },
            { pts: 2, label: 'Vencedor + saldo', ex: 'Apostou 2×0, deu 3×1', color: '#4A8EE8' },
            { pts: 1, label: 'Só o vencedor/empate', ex: 'Apostou 1×0, deu 3×0', color: '#F59E0B' },
          ].map(r => (
            <div key={r.pts} className="flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{ background: 'rgba(5,13,27,0.5)' }}>
              <span className="font-display font-black" style={{ fontSize: 22, color: r.color }}>{r.pts}<span className="text-[10px] ml-0.5">pt{r.pts > 1 ? 's' : ''}</span></span>
              <div className="min-w-0">
                <div className="text-xs font-bold text-white">{r.label}</div>
                <div className="text-[10px]" style={{ color: '#5070A0' }}>{r.ex}</div>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[10px] mt-3" style={{ color: '#5070A0' }}>
          Desempate no ranking: 1º mais placares exatos · 2º mais votos (avaliações) na plataforma.
        </p>
      </div>

      {/* Escolha da partida + palpite */}
      <h3 className="font-display font-bold text-white mb-3" style={{ fontSize: 14 }}>Faça seu palpite</h3>
      {openMatches.length === 0 ? (
        <div className="rounded-2xl px-6 py-10 text-center mb-8" style={{ background: '#0A1528', border: '1px solid rgba(255,255,255,0.05)' }}>
          <Lock size={22} className="mx-auto mb-2" style={{ color: '#2A3A50' }} />
          <p className="text-sm" style={{ color: '#5070A0' }}>Nenhuma partida aberta para palpites no momento. Volte quando o próximo jogo for cadastrado.</p>
        </div>
      ) : (
        <div className="mb-8">
          <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
            {openMatches.map(m => {
              const active = m.dbId === selected?.dbId
              const hasPred = predictions.some(p => p.user_id === user?.id && p.fixture_id === m.dbId)
              return (
                <button key={m.dbId} onClick={() => setSelectedId(m.dbId!)}
                  className="flex-shrink-0 px-4 py-2.5 rounded-xl text-left transition-all duration-150"
                  style={{
                    background: active ? 'linear-gradient(135deg, rgba(0,48,135,0.7), rgba(26,95,204,0.35))' : '#0A1528',
                    border: active ? '1px solid rgba(26,95,204,0.5)' : '1px solid rgba(255,255,255,0.05)',
                  }}>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white whitespace-nowrap">{m.home} × {m.away}</span>
                    {hasPred && <CheckCircle size={12} style={{ color: '#22C55E', flexShrink: 0 }} />}
                  </div>
                  <div className="text-[10px] whitespace-nowrap" style={{ color: active ? '#7FA8E0' : '#3A5070' }}>{m.date} · {m.comp}</div>
                </button>
              )
            })}
          </div>

          {selected && (
            <div className="rounded-2xl p-6" style={{ background: '#0A1528', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="text-center mb-1">
                <span className="text-[11px] font-bold tracking-widest uppercase" style={{ color: '#5070A0' }}>{selected.comp}</span>
              </div>
              <div className="flex items-center justify-center gap-1.5 text-xs mb-5" style={{ color: '#3A5070' }}>
                <Clock size={11} />
                Palpites encerram em {fmtCountdown(cutoffOf(selected) - now)}
              </div>
              <div className="flex items-center justify-center gap-6 sm:gap-10">
                <div className="flex flex-col items-center gap-2" style={{ width: 90 }}>
                  <TeamCrest team={selected.home} size={44} />
                  <span className="text-xs font-bold text-white text-center">{selected.home}</span>
                </div>
                <ScoreStepper value={homePred} onChange={setHomePred} disabled={saving} />
                <span className="font-display font-thin" style={{ fontSize: 30, color: 'rgba(255,255,255,0.18)' }}>×</span>
                <ScoreStepper value={awayPred} onChange={setAwayPred} disabled={saving} />
                <div className="flex flex-col items-center gap-2" style={{ width: 90 }}>
                  <TeamCrest team={selected.away} size={44} />
                  <span className="text-xs font-bold text-white text-center">{selected.away}</span>
                </div>
              </div>
              {msg && (
                <p className="text-center text-xs mt-4 font-semibold" style={{ color: msg.kind === 'ok' ? '#22C55E' : '#EF4444' }}>{msg.text}</p>
              )}
              <button onClick={submit} disabled={saving}
                className="w-full mt-5 py-3.5 rounded-2xl font-display font-bold text-white text-sm transition-all duration-200"
                style={{ background: 'linear-gradient(135deg, #003087, #1A5FCC)', boxShadow: '0 4px 20px rgba(26,95,204,0.35)', opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Salvando...' : myPrediction ? 'Atualizar Palpite' : 'Enviar Palpite'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Ranking + meus palpites */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h3 className="font-display font-bold text-white mb-3" style={{ fontSize: 14 }}>Ranking do Bolão</h3>
          {ranking.length === 0 ? (
            <div className="rounded-2xl px-6 py-8 text-center" style={{ background: '#0A1528', border: '1px solid rgba(255,255,255,0.05)' }}>
              <p className="text-sm" style={{ color: '#5070A0' }}>Ainda não há pontos computados. Os pontos aparecem quando as partidas com palpites terminam.</p>
            </div>
          ) : (
            <div className="rounded-2xl overflow-hidden" style={{ background: '#0A1528', border: '1px solid rgba(255,255,255,0.06)' }}>
              {ranking.slice(0, 20).map((r, i) => (
                <div key={r.uid} className="flex items-center gap-3 px-4 py-3"
                  style={{
                    borderBottom: i < Math.min(ranking.length, 20) - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                    background: r.uid === user?.id ? 'rgba(26,95,204,0.1)' : 'transparent',
                  }}>
                  <span className="font-display font-black w-6 text-center" style={{ fontSize: 14, color: i === 0 ? '#E8C840' : i === 1 ? '#9AAAB8' : i === 2 ? '#C48040' : '#3A5070' }}>{i + 1}</span>
                  {i === 0 && <Crown size={13} style={{ color: '#E8C840', flexShrink: 0 }} />}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-white truncate">{r.name}{r.uid === user?.id ? ' (você)' : ''}</div>
                    <div className="text-[10px]" style={{ color: '#3A5070' }}>{r.n} {r.n === 1 ? 'palpite' : 'palpites'} · {r.exact} na mosca · {r.votes} {r.votes === 1 ? 'voto' : 'votos'}</div>
                  </div>
                  <span className="font-display font-black" style={{ fontSize: 18, color: '#4A8EE8' }}>{r.pts} <span className="text-[10px] font-bold" style={{ color: '#3A5070' }}>pts</span></span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <h3 className="font-display font-bold text-white mb-3" style={{ fontSize: 14 }}>Meus Palpites</h3>
          {mine.length === 0 ? (
            <div className="rounded-2xl px-6 py-8 text-center" style={{ background: '#0A1528', border: '1px solid rgba(255,255,255,0.05)' }}>
              <p className="text-sm" style={{ color: '#5070A0' }}>Você ainda não deixou nenhum palpite. Escolha uma partida acima e mande o seu!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {mine.map(({ p, match: m, fin }) => {
                const pts = fin ? predictionPoints(p.home_pred, p.away_pred, fin.hs, fin.as) : null
                return (
                  <div key={p.id} className="flex items-center gap-3 px-4 py-3 rounded-xl"
                    style={{ background: '#0A1528', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-white truncate">{m ? `${m.home} × ${m.away}` : 'Partida'}</div>
                      <div className="text-[10px]" style={{ color: '#3A5070' }}>
                        Palpite {p.home_pred}×{p.away_pred}{fin ? ` · Placar ${fin.hs}×${fin.as}` : m ? ` · ${m.date}` : ''}
                      </div>
                    </div>
                    {pts != null ? (
                      <span className="font-display font-black" style={{ fontSize: 16, color: ptsColor(pts) }}>+{pts} <span className="text-[10px] font-bold" style={{ color: '#3A5070' }}>pts</span></span>
                    ) : (
                      <span className="text-[10px] font-semibold px-2 py-1 rounded-full" style={{ background: 'rgba(26,95,204,0.15)', color: '#4A8EE8' }}>aguardando</span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Admin Page ───────────────────────────────────────────────────────────────

const ADMIN_INPUT = 'w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none'
const ADMIN_INPUT_STYLE = { background: '#091423', border: '1px solid rgba(255,255,255,0.08)', fontFamily: 'Inter, sans-serif' } as const

function AdminOverviewTab() {
  const { players: PLAYERS, matches: MATCHES } = useData()
  const totalVotes = PLAYERS.reduce((s, p) => s + p.votes, 0)
  const ratedPlayers = PLAYERS.filter(p => p.votes > 0).length
  const releasedCount = MATCHES.filter(m => m.liberado).length
  const topVoted = [...PLAYERS].sort((a, b) => b.votes - a.votes).slice(0, 5)
  const maxVotes = topVoted[0]?.votes || 1

  const stats = [
    { icon: Vote, label: 'Total de votos', value: totalVotes.toLocaleString('pt-BR'), color: '#4A8EE8' },
    { icon: Users, label: 'Jogadores avaliados', value: String(ratedPlayers), color: '#22C55E' },
    { icon: CheckCircle, label: 'Jogos liberados', value: String(releasedCount), color: '#C4972A' },
    { icon: Activity, label: 'Partidas no total', value: String(MATCHES.length), color: '#8B5CF6' },
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-3">
        {stats.map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="rounded-2xl p-5" style={{ background: '#0A1528', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: color + '12' }}>
              <Icon size={16} style={{ color }} />
            </div>
            <div className="font-display font-black text-white" style={{ fontSize: 24 }}>{value}</div>
            <div className="text-xs mt-0.5" style={{ color: '#5070A0' }}>{label}</div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl p-5" style={{ background: '#0A1528', border: '1px solid rgba(255,255,255,0.05)' }}>
        <h3 className="font-display font-bold text-white mb-4" style={{ fontSize: 14 }}>Mais Votados</h3>
        {topVoted.some(p => p.votes > 0) ? (
          <div className="space-y-3">
            {topVoted.map((p, i) => (
              <div key={p.id} className="flex items-center gap-3">
                <span className="font-display font-black text-xs w-4 text-center" style={{ color: i === 0 ? '#C4972A' : '#2A3A50' }}>#{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-white truncate">{p.short}</div>
                  <div className="h-1 rounded-full mt-1 overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                    <div className="h-full rounded-full" style={{ width: `${(p.votes / maxVotes) * 100}%`, background: RARITY_CFG[p.rarity].accent }} />
                  </div>
                </div>
                <span className="text-xs font-bold" style={{ color: '#3A5070' }}>{fmtVotes(p.votes)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs" style={{ color: '#5070A0' }}>Nenhum voto ainda.</p>
        )}
      </div>
    </div>
  )
}

const emptyStats = (): Record<StatKey, { home: string; away: string }> =>
  STAT_FIELDS.reduce((acc, f) => { acc[f.key] = { home: '', away: '' }; return acc }, {} as Record<StatKey, { home: string; away: string }>)

const EMPTY_MATCH_FORM = { id: '', home: 'Cruzeiro', away: '', comp: 'Campeonato Brasileiro', date: '', stadium: '', homeScore: '', awayScore: '', isNew: true, stats: emptyStats() }

function AdminMatchesTab() {
  const { matches: MATCHES, fixtureRows, reload } = useData()
  const [savingId, setSavingId] = useState<string | null>(null)
  const [compFilter, setCompFilter] = useState<string>('all')
  const [form, setForm] = useState(EMPTY_MATCH_FORM)
  const [saving, setSaving] = useState(false)

  const competitions = Array.from(new Set(MATCHES.map(m => m.comp)))
  const listed = MATCHES.filter(m => compFilter === 'all' || m.comp === compFilter)

  const toLocalInput = (ts?: number) => {
    if (!ts) return ''
    const d = new Date(ts * 1000)
    const p = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
  }

  const startEdit = (m: Match) => {
    const r = fixtureRows.find(x => x.id === m.dbId)
    if (!r) return
    const stats = emptyStats()
    for (const f of STAT_FIELDS) {
      const h = (r as Record<string, unknown>)[`${f.key}_home`] as number | null | undefined
      const a = (r as Record<string, unknown>)[`${f.key}_away`] as number | null | undefined
      stats[f.key] = { home: h == null ? '' : String(h), away: a == null ? '' : String(a) }
    }
    setForm({
      id: r.id,
      home: r.home_team,
      away: r.away_team,
      comp: r.competition,
      date: toLocalInput(r.ts) || (r.fixture_date.includes('T') ? r.fixture_date : r.fixture_date + 'T00:00'),
      stadium: r.stadium ?? '',
      homeScore: r.home_score == null ? '' : String(r.home_score),
      awayScore: r.away_score == null ? '' : String(r.away_score),
      isNew: false,
      stats,
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const toggleLiberado = async (m: Match) => {
    if (!m.dbId) return
    setSavingId(m.dbId)
    const { error } = await supabase.from('fixtures').update({ liberado: !m.liberado }).eq('id', m.dbId)
    setSavingId(null)
    if (error) { console.error(error); alert('Não foi possível atualizar. Verifique se você é admin.') }
    else reload()
  }

  const save = async () => {
    if (!form.home.trim() || !form.away.trim() || !form.date) { alert('Preencha mandante, visitante e data.'); return }
    setSaving(true)
    const ts = Math.floor(new Date(form.date).getTime() / 1000)
    const hasScores = form.homeScore !== '' && form.awayScore !== ''
    const statCols: Record<string, number | null> = {}
    for (const f of STAT_FIELDS) {
      const s = form.stats[f.key]
      statCols[`${f.key}_home`] = s.home === '' ? null : Number(s.home)
      statCols[`${f.key}_away`] = s.away === '' ? null : Number(s.away)
    }
    const payload: Record<string, unknown> = {
      home_team: form.home.trim(),
      away_team: form.away.trim(),
      home_score: hasScores ? Number(form.homeScore) : null,
      away_score: hasScores ? Number(form.awayScore) : null,
      fixture_date: form.date,
      ts,
      competition: form.comp.trim() || 'Amistoso',
      stadium: form.stadium.trim() || null,
      status: hasScores ? 'finished' : 'notstarted',
      ...statCols,
    }
    let error: { message: string } | null = null
    if (form.isNew) {
      const res = await supabase.from('fixtures').insert({ id: 'adm_' + Date.now(), ...payload, liberado: false, manual: true })
      error = res.error
    } else {
      const res = await supabase.from('fixtures').update(payload).eq('id', form.id)
      error = res.error
    }
    setSaving(false)
    if (error) { console.error(error); alert('Não foi possível salvar. Verifique se você é admin.') }
    else { setForm({ ...EMPTY_MATCH_FORM, comp: form.comp }); reload() }
  }

  return (
    <div className="space-y-6">
      {/* Adicionar / editar jogo */}
      <div className="rounded-2xl p-5" style={{ background: '#0A1528', border: '1px solid rgba(255,255,255,0.05)' }}>
        <h3 className="font-display font-bold text-white mb-4" style={{ fontSize: 14 }}>{form.isNew ? 'Adicionar jogo' : `Editar: ${form.home} × ${form.away}`}</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] block mb-1" style={{ color: '#5070A0' }}>Mandante</label>
            <input className={ADMIN_INPUT} style={ADMIN_INPUT_STYLE} value={form.home} onChange={e => setForm(f => ({ ...f, home: e.target.value }))} />
          </div>
          <div>
            <label className="text-[11px] block mb-1" style={{ color: '#5070A0' }}>Visitante</label>
            <input className={ADMIN_INPUT} style={ADMIN_INPUT_STYLE} value={form.away} onChange={e => setForm(f => ({ ...f, away: e.target.value }))} />
          </div>
          <div>
            <label className="text-[11px] block mb-1" style={{ color: '#5070A0' }}>Competição</label>
            <input className={ADMIN_INPUT} style={ADMIN_INPUT_STYLE} value={form.comp} onChange={e => setForm(f => ({ ...f, comp: e.target.value }))} />
          </div>
          <div>
            <label className="text-[11px] block mb-1" style={{ color: '#5070A0' }}>Data e hora</label>
            <input type="datetime-local" className={ADMIN_INPUT} style={ADMIN_INPUT_STYLE} value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
          </div>
          <div>
            <label className="text-[11px] block mb-1" style={{ color: '#5070A0' }}>Estádio</label>
            <input className={ADMIN_INPUT} style={ADMIN_INPUT_STYLE} value={form.stadium} onChange={e => setForm(f => ({ ...f, stadium: e.target.value }))} />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-[11px] block mb-1" style={{ color: '#5070A0' }}>Placar mandante</label>
              <input type="number" className={ADMIN_INPUT} style={ADMIN_INPUT_STYLE} value={form.homeScore} onChange={e => setForm(f => ({ ...f, homeScore: e.target.value }))} />
            </div>
            <div className="flex-1">
              <label className="text-[11px] block mb-1" style={{ color: '#5070A0' }}>Placar visitante</label>
              <input type="number" className={ADMIN_INPUT} style={ADMIN_INPUT_STYLE} value={form.awayScore} onChange={e => setForm(f => ({ ...f, awayScore: e.target.value }))} />
            </div>
          </div>
        </div>
        <p className="text-[11px] mt-2" style={{ color: '#3A5070' }}>Deixe o placar em branco para jogo futuro. Preencha para um jogo já encerrado.</p>

        {/* Estatísticas da partida */}
        <div className="mt-5 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-display font-bold text-white" style={{ fontSize: 13 }}>Estatísticas da partida <span style={{ color: '#3A5070', fontWeight: 400 }}>(opcional)</span></h4>
            <span className="text-[10px]" style={{ color: '#3A5070' }}>Mandante · Visitante</span>
          </div>
          <div className="space-y-2">
            {STAT_FIELDS.map(f => (
              <div key={f.key} className="flex items-center gap-3">
                <span className="flex-1 text-[12px]" style={{ color: '#5070A0' }}>{f.label}{f.unit ? ` (${f.unit})` : ''}</span>
                <input type="number" className={ADMIN_INPUT} style={{ ...ADMIN_INPUT_STYLE, width: 72, textAlign: 'center' }}
                  value={form.stats[f.key].home}
                  onChange={e => setForm(fm => ({ ...fm, stats: { ...fm.stats, [f.key]: { ...fm.stats[f.key], home: e.target.value } } }))} />
                <input type="number" className={ADMIN_INPUT} style={{ ...ADMIN_INPUT_STYLE, width: 72, textAlign: 'center' }}
                  value={form.stats[f.key].away}
                  onChange={e => setForm(fm => ({ ...fm, stats: { ...fm.stats, [f.key]: { ...fm.stats[f.key], away: e.target.value } } }))} />
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <button onClick={save} disabled={saving}
            className="px-4 py-2.5 rounded-xl font-display font-bold text-white text-sm"
            style={{ background: 'linear-gradient(135deg, #003087, #1A5FCC)', opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Salvando...' : form.isNew ? 'Adicionar jogo' : 'Salvar alterações'}
          </button>
          {!form.isNew && (
            <button onClick={() => setForm({ ...EMPTY_MATCH_FORM, comp: form.comp })}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold" style={{ background: 'rgba(255,255,255,0.05)', color: '#5070A0' }}>
              Cancelar edição
            </button>
          )}
        </div>
      </div>

      {/* Liberar jogos */}
      <div className="rounded-2xl overflow-hidden" style={{ background: '#0A1528', border: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="px-5 py-4 flex items-center justify-between flex-wrap gap-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <h3 className="font-display font-bold text-white" style={{ fontSize: 14 }}>Liberar jogos para votação</h3>
          <div className="flex gap-2 flex-wrap">
            {['all', ...competitions].map(c => (
              <button key={c} onClick={() => setCompFilter(c)}
                className="px-3 py-1 rounded-lg text-[11px] font-semibold transition-all duration-150"
                style={{ background: compFilter === c ? 'rgba(26,95,204,0.18)' : 'rgba(255,255,255,0.04)', color: compFilter === c ? '#4A8EE8' : '#5070A0', border: compFilter === c ? '1px solid rgba(26,95,204,0.4)' : '1px solid transparent' }}>
                {c === 'all' ? 'Todas' : c}
              </button>
            ))}
          </div>
        </div>
        <div style={{ maxHeight: 460, overflowY: 'auto' }}>
          {listed.map((m, i) => (
            <div key={m.id} className="flex items-center gap-4 px-5 py-3"
              style={{ borderBottom: i < listed.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-white truncate">{m.home} × {m.away}</div>
                <div className="text-[11px] mt-0.5" style={{ color: '#5070A0' }}>
                  {m.comp} · {m.date} · {m.status === 'finished' ? 'Encerrado' : 'Agendado'}
                </div>
              </div>
              <button onClick={() => startEdit(m)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold flex-shrink-0"
                style={{ background: 'rgba(26,95,204,0.15)', color: '#4A8EE8' }}>
                Editar
              </button>
              <button onClick={() => toggleLiberado(m)} disabled={savingId === m.dbId}
                className="px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 flex-shrink-0 transition-all duration-150"
                style={{
                  background: m.liberado ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.05)',
                  color: m.liberado ? '#22C55E' : '#5070A0',
                  border: `1px solid ${m.liberado ? 'rgba(34,197,94,0.35)' : 'rgba(255,255,255,0.08)'}`,
                  opacity: savingId === m.dbId ? 0.5 : 1,
                }}>
                {savingId === m.dbId ? '...' : m.liberado ? <><CheckCircle size={12} /> Liberado</> : 'Liberar'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function AdminPlayersTab() {
  const { players: PLAYERS, matches: MATCHES, fixturePlayers, reload } = useData()
  const [fid, setFid] = useState<string>('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)

  // Initialize the selection from the current fixture_players of the chosen match.
  useEffect(() => {
    if (!fid) { setSelected(new Set()); return }
    const current = fixturePlayers.filter(fp => fp.fixture_id === fid).map(fp => fp.player_id)
    setSelected(new Set(current))
  }, [fid, fixturePlayers])

  const toggle = (pid: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(pid)) next.delete(pid)
      else next.add(pid)
      return next
    })
  }

  const save = async () => {
    if (!fid) return
    setSaving(true)
    await supabase.from('fixture_players').delete().eq('fixture_id', fid)
    if (selected.size > 0) {
      const rows = [...selected].map(pid => ({ fixture_id: fid, player_id: pid }))
      const { error } = await supabase.from('fixture_players').insert(rows)
      if (error) { console.error(error); alert('Não foi possível salvar. Verifique se você é admin.'); setSaving(false); return }
    }
    setSaving(false)
    reload()
    alert('Seleção salva!')
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl p-5" style={{ background: '#0A1528', border: '1px solid rgba(255,255,255,0.05)' }}>
        <h3 className="font-display font-bold text-white mb-2" style={{ fontSize: 14 }}>Jogadores da partida</h3>
        <p className="text-[12px] mb-4" style={{ color: '#5070A0' }}>Escolha um jogo e marque quais jogadores entram na votação. Sem seleção, a votação usa o elenco inteiro.</p>
        <select className={ADMIN_INPUT} style={ADMIN_INPUT_STYLE} value={fid} onChange={e => setFid(e.target.value)}>
          <option value="">Selecione um jogo...</option>
          {MATCHES.map(m => (
            <option key={m.id} value={m.dbId ?? ''}>{m.home} × {m.away} — {m.comp} ({m.date})</option>
          ))}
        </select>
      </div>

      {fid && (
        <div className="rounded-2xl p-5" style={{ background: '#0A1528', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold" style={{ color: '#7090B0' }}>{selected.size} selecionado(s)</span>
            <div className="flex gap-2">
              <button onClick={() => setSelected(new Set(PLAYERS.map(p => p.dbId!).filter(Boolean)))}
                className="text-[11px] font-semibold px-2 py-1 rounded-lg" style={{ background: 'rgba(255,255,255,0.05)', color: '#5070A0' }}>Todos</button>
              <button onClick={() => setSelected(new Set())}
                className="text-[11px] font-semibold px-2 py-1 rounded-lg" style={{ background: 'rgba(255,255,255,0.05)', color: '#5070A0' }}>Nenhum</button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2" style={{ maxHeight: 380, overflowY: 'auto' }}>
            {PLAYERS.map(p => {
              const on = p.dbId ? selected.has(p.dbId) : false
              return (
                <button key={p.id} onClick={() => p.dbId && toggle(p.dbId)}
                  className="flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-all duration-150"
                  style={{ background: on ? 'rgba(26,95,204,0.15)' : 'rgba(255,255,255,0.03)', border: `1px solid ${on ? 'rgba(26,95,204,0.4)' : 'rgba(255,255,255,0.05)'}` }}>
                  <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
                    style={{ background: on ? '#1A5FCC' : 'rgba(255,255,255,0.06)' }}>
                    {on && <CheckCircle size={13} className="text-white" />}
                  </div>
                  <span className="text-xs font-semibold text-white truncate">{p.name}</span>
                  <span className="text-[10px] ml-auto" style={{ color: '#3A5070' }}>{p.pos}</span>
                </button>
              )
            })}
          </div>
          <button onClick={save} disabled={saving}
            className="mt-4 px-4 py-2.5 rounded-xl font-display font-bold text-white text-sm"
            style={{ background: 'linear-gradient(135deg, #003087, #1A5FCC)', opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Salvando...' : 'Salvar seleção'}
          </button>
        </div>
      )}
    </div>
  )
}

const POSITION_PT: Record<string, string> = {
  Goalkeeper: 'Goleiro', Defender: 'Defensor', Midfielder: 'Meio-campo', Attacker: 'Atacante',
}

function AdminSquadTab() {
  const { squadRows, reload } = useData()
  const [form, setForm] = useState<null | { id: string; name: string; position: string; number: string; nationality: string; photo: string; isNew: boolean }>(null)
  const [saving, setSaving] = useState(false)

  const startNew = () => setForm({ id: '', name: '', position: 'Attacker', number: '', nationality: 'Brazil', photo: '', isNew: true })
  const startEdit = (r: DbSquadRow) => setForm({ id: r.id, name: r.name, position: r.position, number: r.number ?? '', nationality: r.nationality ?? '', photo: r.photo ?? '', isNew: false })

  const save = async () => {
    if (!form || !form.name.trim()) { alert('Informe o nome do jogador.'); return }
    setSaving(true)
    const payload = {
      name: form.name.trim(),
      position: form.position,
      number: form.number.trim() || null,
      nationality: form.nationality.trim() || null,
      photo: form.photo.trim() || null,
      manual: true,
    }
    let error: { message: string } | null = null
    if (form.isNew) {
      const res = await supabase.from('squad').insert({ id: 'sq_' + Date.now(), ...payload })
      error = res.error
    } else {
      const res = await supabase.from('squad').update(payload).eq('id', form.id)
      error = res.error
    }
    setSaving(false)
    if (error) { console.error('Falha ao salvar jogador', error); alert('Não foi possível salvar. Verifique se você é admin.') }
    else { setForm(null); reload() }
  }

  const remove = async (r: DbSquadRow) => {
    if (!confirm(`Remover ${r.name} do elenco?`)) return
    const { error } = await supabase.from('squad').delete().eq('id', r.id)
    if (error) { console.error(error); alert('Não foi possível remover.') }
    else reload()
  }

  const ordered = [...squadRows].sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div className="space-y-5">
      {form ? (
        <div className="rounded-2xl p-5" style={{ background: '#0A1528', border: '1px solid rgba(255,255,255,0.05)' }}>
          <h3 className="font-display font-bold text-white mb-4" style={{ fontSize: 14 }}>{form.isNew ? 'Adicionar jogador' : `Editar ${form.name}`}</h3>
          <div className="flex gap-4">
            <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center" style={{ background: '#091423', border: '1px solid rgba(255,255,255,0.08)' }}>
              {form.photo ? <img src={form.photo} alt="" className="w-full h-full object-cover object-top" /> : <span className="text-xs" style={{ color: '#3A5070' }}>sem foto</span>}
            </div>
            <div className="flex-1 grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-[11px] block mb-1" style={{ color: '#5070A0' }}>Nome</label>
                <input className={ADMIN_INPUT} style={ADMIN_INPUT_STYLE} value={form.name} onChange={e => setForm(f => f && ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="text-[11px] block mb-1" style={{ color: '#5070A0' }}>Posição</label>
                <select className={ADMIN_INPUT} style={ADMIN_INPUT_STYLE} value={form.position} onChange={e => setForm(f => f && ({ ...f, position: e.target.value }))}>
                  {['Goalkeeper', 'Defender', 'Midfielder', 'Attacker'].map(p => <option key={p} value={p}>{POSITION_PT[p]}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11px] block mb-1" style={{ color: '#5070A0' }}>Número</label>
                <input className={ADMIN_INPUT} style={ADMIN_INPUT_STYLE} value={form.number} onChange={e => setForm(f => f && ({ ...f, number: e.target.value }))} />
              </div>
              <div>
                <label className="text-[11px] block mb-1" style={{ color: '#5070A0' }}>Nacionalidade</label>
                <input className={ADMIN_INPUT} style={ADMIN_INPUT_STYLE} value={form.nationality} onChange={e => setForm(f => f && ({ ...f, nationality: e.target.value }))} placeholder="Brazil" />
              </div>
              <div>
                <label className="text-[11px] block mb-1" style={{ color: '#5070A0' }}>Foto (URL)</label>
                <input className={ADMIN_INPUT} style={ADMIN_INPUT_STYLE} value={form.photo} onChange={e => setForm(f => f && ({ ...f, photo: e.target.value }))} placeholder="https://..." />
              </div>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={save} disabled={saving}
              className="px-4 py-2.5 rounded-xl font-display font-bold text-white text-sm"
              style={{ background: 'linear-gradient(135deg, #003087, #1A5FCC)', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
            <button onClick={() => setForm(null)} className="px-4 py-2.5 rounded-xl text-sm font-semibold" style={{ background: 'rgba(255,255,255,0.05)', color: '#5070A0' }}>Cancelar</button>
          </div>
        </div>
      ) : (
        <button onClick={startNew}
          className="px-4 py-2.5 rounded-xl font-display font-bold text-white text-sm"
          style={{ background: 'linear-gradient(135deg, #003087, #1A5FCC)' }}>
          + Adicionar jogador
        </button>
      )}

      <div className="rounded-2xl overflow-hidden" style={{ background: '#0A1528', border: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <h3 className="font-display font-bold text-white" style={{ fontSize: 14 }}>Elenco ({ordered.length})</h3>
        </div>
        <div style={{ maxHeight: 520, overflowY: 'auto' }}>
          {ordered.map((r, i) => (
            <div key={r.id} className="flex items-center gap-3 px-5 py-3"
              style={{ borderBottom: i < ordered.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
              <div className="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center" style={{ background: '#091423' }}>
                {r.photo ? <img src={r.photo} alt="" className="w-full h-full object-cover object-top" /> : <span className="text-[10px] font-bold text-white">{r.number ?? '?'}</span>}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-white truncate">{r.name}</div>
                <div className="text-[11px]" style={{ color: '#5070A0' }}>{POSITION_PT[r.position] ?? r.position} · #{r.number ?? '—'} · {r.nationality ?? '—'}</div>
              </div>
              <button onClick={() => startEdit(r)} className="px-2.5 py-1 rounded-lg text-[11px] font-semibold" style={{ background: 'rgba(26,95,204,0.15)', color: '#4A8EE8' }}>Editar</button>
              <button onClick={() => remove(r)} className="px-2.5 py-1 rounded-lg text-[11px] font-semibold" style={{ background: 'rgba(239,68,68,0.12)', color: '#FF6060' }}>Remover</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function AdminPage() {
  const [tab, setTab] = useState<'matches' | 'players' | 'squad' | 'overview'>('matches')
  const tabs: { id: typeof tab; label: string }[] = [
    { id: 'matches', label: 'Partidas' },
    { id: 'players', label: 'Jogadores da partida' },
    { id: 'squad', label: 'Elenco' },
    { id: 'overview', label: 'Visão geral' },
  ]

  return (
    <div className="px-6 pb-12">
      <div className="pt-8 pb-5">
        <div className="flex items-center gap-2 mb-1">
          <Shield size={15} style={{ color: '#C4972A' }} />
          <span className="text-xs font-bold tracking-widest uppercase" style={{ color: '#C4972A' }}>Painel Administrativo</span>
        </div>
        <h2 className="font-display font-black text-white" style={{ fontSize: 30 }}>Administração</h2>
      </div>

      <div className="flex gap-1 p-1 rounded-2xl mb-7" style={{ background: '#0A1528', maxWidth: 680 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="flex-1 py-2.5 px-3 rounded-xl text-sm font-semibold transition-all duration-200 whitespace-nowrap"
            style={{ background: tab === t.id ? '#003087' : 'transparent', color: tab === t.id ? 'white' : '#5070A0' }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'matches' && <AdminMatchesTab />}
      {tab === 'players' && <AdminPlayersTab />}
      {tab === 'squad' && <AdminSquadTab />}
      {tab === 'overview' && <AdminOverviewTab />}
    </div>
  )
}

// ─── Auth Page ────────────────────────────────────────────────────────────────

function AuthPage() {
  const [tab, setTab] = useState<'login' | 'register'>('login')
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' })
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [forgot, setForgot] = useState(false)
  const [forgotSent, setForgotSent] = useState(false)
  const [voters, setVoters] = useState(0)

  // Real "torcedores avaliando" = distinct users who submitted a rating.
  useEffect(() => {
    supaGet<{ user_id: string }[]>('ratings?select=user_id')
      .then(rows => setVoters(new Set(rows.map(r => r.user_id)).size))
      .catch(() => {})
  }, [])

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setErrors({})
    setLoading(true)
    try {
      if (tab === 'register') {
        const { data, error } = await supabase.auth.signUp({
          email: form.email,
          password: form.password,
          options: { data: { name: form.name.trim() } },
        })
        if (error) throw error
        if (!data.session) {
          setErrors({ email: 'Conta criada! Confirme o e-mail que enviamos para poder entrar.' })
          setLoading(false)
          return
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: form.email,
          password: form.password,
        })
        if (error) throw error
      }
      // On success the auth listener flips the app to the logged-in view.
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha na autenticação'
      setErrors({ email: msg })
      setLoading(false)
    }
  }

  const handleForgot = async () => {
    if (!form.email.includes('@')) { setErrors({ email: 'Informe um e-mail válido' }); return }
    setErrors({})
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(form.email, {
      redirectTo: window.location.origin + import.meta.env.BASE_URL,
    })
    setLoading(false)
    if (error) setErrors({ email: error.message })
    else setForgotSent(true)
  }

  // Forgot-password panel (request the reset email).
  if (forgot) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6" style={{ backgroundColor: '#030910' }}>
        <div style={{ width: '100%', maxWidth: 400 }}>
          <div className="flex justify-center mb-8">
            <JeanScoreLogo width={170} showStars={false} />
          </div>
          {forgotSent ? (
            <div className="rounded-2xl p-6 text-center" style={{ background: '#0A1528', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'linear-gradient(135deg, #003087, #1A5FCC)' }}>
                <CheckCircle size={28} className="text-white" />
              </div>
              <h2 className="font-display font-black text-white mb-2" style={{ fontSize: 20 }}>Verifique seu e-mail</h2>
              <p className="text-sm mb-6" style={{ color: '#5070A0' }}>Enviamos um link para <span className="text-white font-semibold">{form.email}</span> redefinir sua senha.</p>
              <button onClick={() => { setForgot(false); setForgotSent(false) }}
                className="w-full py-3 rounded-2xl font-display font-bold text-white text-sm"
                style={{ background: 'linear-gradient(135deg, #003087, #1A5FCC)' }}>
                Voltar ao login
              </button>
            </div>
          ) : (
            <>
              <div className="mb-8 text-center">
                <h2 className="font-display font-black text-white mb-1.5" style={{ fontSize: 26 }}>Esqueci minha senha</h2>
                <p className="text-sm" style={{ color: '#5070A0' }}>Informe seu e-mail e enviaremos um link de redefinição</p>
              </div>
              <div className="space-y-4">
                <input type="email" placeholder="Seu e-mail" value={form.email} onChange={set('email')}
                  className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none"
                  style={{ background: '#0A1528', border: `1px solid ${errors.email ? '#EF444450' : 'rgba(255,255,255,0.07)'}`, fontFamily: 'Inter, sans-serif' }} />
                {errors.email && <p className="text-xs" style={{ color: '#FF6060' }}>{errors.email}</p>}
                <button onClick={handleForgot} disabled={loading}
                  className="w-full py-3 rounded-2xl font-display font-bold text-white text-sm"
                  style={{ background: 'linear-gradient(135deg, #003087, #1A5FCC)', opacity: loading ? 0.6 : 1 }}>
                  {loading ? 'Enviando...' : 'Enviar link de redefinição'}
                </button>
                <button type="button" onClick={() => { setForgot(false); setErrors({}) }}
                  className="w-full py-2 text-xs font-semibold" style={{ color: '#5070A0' }}>
                  Voltar ao login
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    )
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
              Temporada 2026
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
              {['J', 'W', 'P', 'A'].map((l, i) => (
                <div key={i} className="w-8 h-8 rounded-full flex items-center justify-center font-display font-black text-xs text-white border-2"
                  style={{ background: `linear-gradient(135deg, #003087, #1A5FCC)`, borderColor: '#030910' }}>
                  {l}
                </div>
              ))}
            </div>
            <div>
              <div className="font-display font-bold text-white text-sm">+{(voters * 1000).toLocaleString('pt-BR')} torcedores</div>
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

          {tab === 'login' && (
            <button type="button" onClick={() => { setForgot(true); setForgotSent(false); setErrors({}) }}
              className="w-full mt-3 text-xs font-semibold text-center" style={{ color: '#4A8EE8' }}>
              Esqueci minha senha
            </button>
          )}

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

function Root() {
  const { user, loading: authLoading, recovery, isAdmin } = useAuth()
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
    matches: 'Partidas', rate: 'Votar', bolao: 'Bolão Cabuloso', admin: 'Admin',
    profile: selectedPlayer?.name ?? 'Perfil',
    'match-detail': selectedMatch ? `${selectedMatch.home} × ${selectedMatch.away}` : 'Partida',
  }

  const detailPage = page === 'profile' || page === 'match-detail'

  if (authLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#050D1B' }}>
        <span className="animate-spin inline-block" style={{ width: 28, height: 28, border: '3px solid rgba(255,255,255,0.15)', borderTopColor: '#4A8EE8', borderRadius: 9999 }} />
      </div>
    )
  }
  if (recovery) return <ResetPasswordPage />
  if (!user) return <AuthPage />

  return (
    <DataProvider>
    <div style={{ minHeight: '100vh', backgroundColor: '#050D1B', fontFamily: "'Inter', system-ui, sans-serif" }}>
      <Sidebar page={page} setPage={navigate} />

      <main style={{ marginLeft: 60, minHeight: '100vh' }}>
        {!detailPage && <TopBar title={PAGE_TITLES[page]} onSelectPlayer={(p) => { setSelectedPlayer(p); navigate('profile') }} />}

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
        {page === 'bolao' && <BolaoPage />}
        {page === 'admin' && isAdmin && <AdminPage />}
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

export default function App() {
  return (
    <AuthProvider>
      <Root />
    </AuthProvider>
  )
}
