import {
  Backpack,
  BarChart3,
  BookOpen,
  Bot,
  BrainCircuit,
  ClipboardList,
  Clock,
  Compass,
  Database,
  Eye,
  FlaskConical,
  Globe,
  Hammer,
  MessageSquare,
  Music,
  Palette,
  PenLine,
  Search,
  Shield,
  Terminal,
  Wallet,
  Wrench,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export const ICON_MAP: Record<string, LucideIcon> = {
  backpack: Backpack,
  chart: BarChart3,
  book: BookOpen,
  bot: Bot,
  brain: BrainCircuit,
  clipboard: ClipboardList,
  clock: Clock,
  compass: Compass,
  database: Database,
  eye: Eye,
  flask: FlaskConical,
  globe: Globe,
  hammer: Hammer,
  message: MessageSquare,
  music: Music,
  palette: Palette,
  pen: PenLine,
  search: Search,
  shield: Shield,
  wallet: Wallet,
  wrench: Wrench,
}

export const TOOL_CATEGORY_ICON: Record<string, LucideIcon> = {
  executing: Terminal,
  reading: Search,
  writing: PenLine,
  network: Globe,
  waiting: Clock,
  thinking: BrainCircuit,
}

export const FALLBACK_ICON_NAME = 'bot'

const ICON_KEYWORDS: [string, string][] = [
  ['eye', 'lookout'], ['eye', 'foresight'], ['eye', 'observer'], ['eye', 'spotter'],
  ['eye', 'oracle'], ['eye', 'vision'], ['eye', 'seer'], ['eye', 'scout'],
  ['compass', 'wayfinder'], ['compass', 'direction'], ['compass', 'compass'], ['compass', 'navigat'],
  ['compass', 'pilot'], ['compass', 'route'], ['compass', 'guide'], ['compass', 'path'],
  ['pen', 'chronicle'], ['pen', 'notebook'], ['pen', 'memoir'], ['pen', 'diary'],
  ['pen', 'journal'], ['pen', 'reporter'], ['pen', 'scribe'], ['pen', 'author'],
  ['pen', 'writer'], ['pen', 'editor'], ['pen', 'content'], ['pen', 'article'],
  ['pen', 'document'], ['pen', 'blog'], ['pen', 'log'], ['pen', 'record'], ['pen', 'copy'],
  ['hammer', 'fabricat'], ['hammer', 'construct'], ['hammer', 'hammer'], ['hammer', 'forge'],
  ['hammer', 'builder'], ['hammer', 'architect'], ['hammer', 'engineer'], ['hammer', 'developer'],
  ['hammer', 'craft'], ['hammer', 'maker'], ['hammer', 'smith'],
  ['shield', 'safeguard'], ['shield', 'sentinel'], ['shield', 'protector'], ['shield', 'defender'],
  ['shield', 'guardian'], ['shield', 'sentry'], ['shield', 'warden'], ['shield', 'shield'],
  ['shield', 'security'], ['shield', 'guard'], ['shield', 'watch'],
  ['book', 'librarian'], ['book', 'archivist'], ['book', 'investigator'], ['book', 'scientist'],
  ['book', 'scholar'], ['book', 'researcher'], ['book', 'research'], ['book', 'explorer'],
  ['book', 'analyst'], ['book', 'study'], ['book', 'learn'],
  ['backpack', 'hospitality'], ['backpack', 'itinerary'], ['backpack', 'vacation'], ['backpack', 'holiday'],
  ['backpack', 'journey'], ['backpack', 'voyage'], ['backpack', 'excursion'], ['backpack', 'travel'],
  ['backpack', 'concierge'], ['backpack', 'tour'], ['backpack', 'trip'], ['backpack', 'planner'],
  ['clipboard', 'supervisor'], ['clipboard', 'regulator'], ['clipboard', 'governor'], ['clipboard', 'operator'],
  ['clipboard', 'controller'], ['clipboard', 'control'], ['clipboard', 'manager'],
  ['message', 'spokesperson'], ['message', 'announcer'], ['message', 'broadcast'], ['message', 'messenger'],
  ['message', 'communicat'], ['message', 'liaison'], ['message', 'notify'],
  ['globe', 'connector'], ['globe', 'network'], ['globe', 'bridge'], ['globe', 'hub'], ['globe', 'link'],
  ['chart', 'dashboard'], ['chart', 'insight'], ['chart', 'statistics'], ['chart', 'analytic'],
  ['chart', 'metric'], ['chart', 'data'], ['chart', 'report'], ['chart', 'chart'],
  ['search', 'detective'], ['search', 'inspector'], ['search', 'examiner'], ['search', 'auditor'],
  ['search', 'sleuth'], ['search', 'checker'], ['search', 'verifier'], ['search', 'search'], ['search', 'find'],
  ['database', 'repository'], ['database', 'database'], ['database', 'archive'], ['database', 'storage'],
  ['database', 'vault'], ['database', 'cache'], ['database', 'keeper'], ['database', 'store'],
  ['brain', 'strategist'], ['brain', 'strategy'], ['brain', 'consultant'], ['brain', 'adviser'],
  ['brain', 'thinker'], ['brain', 'brain'],
  ['wrench', 'maintenance'], ['wrench', 'technician'], ['wrench', 'mechanic'], ['wrench', 'repair'],
  ['wrench', 'fixer'], ['wrench', 'fix'],
  ['palette', 'stylist'], ['palette', 'aesthetic'], ['palette', 'creative'], ['palette', 'designer'],
  ['palette', 'painter'], ['palette', 'artist'], ['palette', 'art'],
  ['music', 'podcast'], ['music', 'audio'], ['music', 'sound'], ['music', 'music'],
  ['clock', 'deadline'], ['clock', 'schedule'], ['clock', 'calendar'], ['clock', 'timer'], ['clock', 'clock'],
  ['wallet', 'budget'], ['wallet', 'invoice'], ['wallet', 'account'], ['wallet', 'finance'], ['wallet', 'calculator'],
  ['flask', 'validation'], ['flask', 'quality'], ['flask', 'experiment'], ['flask', 'test'],
]

export function iconNameForAgent(nodeId: string, label: string): string {
  const text = `${nodeId} ${label}`.toLowerCase().replace(/[_-]+/g, ' ')
  for (const [name, keyword] of ICON_KEYWORDS) {
    if (text.includes(keyword)) return name
  }
  return FALLBACK_ICON_NAME
}
