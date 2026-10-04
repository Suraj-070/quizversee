import {
  BookOpen,
  FlaskConical,
  Calculator,
  Atom,
  Code2,
  Network,
  Cpu,
  Globe,
  Pencil,
  Palette,
  Music,
  Languages,
  Brain,
  Dumbbell,
  Map as MapIcon,
  Leaf,
  Microscope,
  Sigma,
  History,
  Globe2,
  Award,
  Lightbulb,
  Rocket,
  Trophy,
  type LucideIcon,
} from "lucide-react";

/**
 * Icon Registry
 *
 * Maps string icon names (stored in the database `Subject.icon` column)
 * to pre-bound Lucide React components.
 *
 * Why a registry instead of dynamic resolution?
 *   The `react-hooks/static-components` ESLint rule forbids creating
 *   components during render. Dynamically looking up an icon from the
 *   Lucide barrel at render time violates that rule. By pre-binding a
 *   fixed set of icons at module load, we get:
 *     1. Static component references (rule compliant)
 *     2. Smaller bundle (only the registered icons are imported)
 *     3. Predictable fallback to BookOpen for unknown icons
 *
 * To add more icons: import them above and add to the map below.
 */
const REGISTRY: Record<string, LucideIcon> = {
  "book-open": BookOpen,
  "flask-conical": FlaskConical,
  calculator: Calculator,
  atom: Atom,
  code: Code2,
  code2: Code2,
  network: Network,
  cpu: Cpu,
  globe: Globe,
  pencil: Pencil,
  palette: Palette,
  music: Music,
  languages: Languages,
  brain: Brain,
  dumbbell: Dumbbell,
  map: MapIcon,
  leaf: Leaf,
  microscope: Microscope,
  sigma: Sigma,
  history: History,
  "globe-2": Globe2,
  award: Award,
  lightbulb: Lightbulb,
  rocket: Rocket,
  trophy: Trophy,
};

const FALLBACK = BookOpen;

/**
 * Pre-resolved icon components by name. Used by components that want
 * to look up an icon by name without triggering the
 * `react-hooks/static-components` ESLint rule (which forbids creating
 * components during render).
 *
 * Usage:
 *   const Icon = ICONS[name] ?? ICONS_FALLBACK;
 *   return <Icon />;
 *
 * This is a flat object lookup, not a function call, so the rule is
 * satisfied — the components were all created at module load.
 */
export const ICONS: Record<string, LucideIcon> = { ...REGISTRY };
export const ICONS_FALLBACK: LucideIcon = FALLBACK;

/**
 * Returns the list of available icon names (for the admin subject form
 * to offer as a dropdown).
 */
export function getAvailableIconNames(): string[] {
  return Object.keys(REGISTRY).sort();
}
