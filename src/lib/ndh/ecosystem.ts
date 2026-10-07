/**
 * NDH family directory — the single source of truth for the ecosystem switcher
 * and the platform footer.
 *
 * AgriCapital is the surface this module ships inside; the rest are siblings on
 * ndh.com.ng. Everything here is plain data (no browser APIs) so it is safe to
 * import at module scope during SSR.
 */
import {
  BookOpen,
  BriefcaseBusiness,
  HeartPulse,
  Plane,
  School,
  ShoppingBag,
  Sprout,
  type LucideIcon,
} from "lucide-react";

export type CategoryId = "enterprise" | "education" | "agriculture" | "commerce" | "infrastructure";

export const ECOSYSTEM_CATEGORIES: {
  id: CategoryId;
  label: string;
  icon: LucideIcon;
}[] = [
  { id: "enterprise", label: "Enterprise", icon: BriefcaseBusiness },
  { id: "education", label: "Education", icon: BookOpen },
  { id: "agriculture", label: "Agriculture", icon: Sprout },
  { id: "commerce", label: "Commerce", icon: ShoppingBag },
  { id: "infrastructure", label: "Infrastructure", icon: School },
];

export type SubsidiaryId =
  | "agency"
  | "academy"
  | "agricapital"
  | "estore"
  | "schooldesk"
  | "travel"
  | "ihospital";

/** `live` is launched and public, `preview` is a working pre-launch build. */
export type LaunchState = "live" | "preview" | "coming";

export type Subsidiary = {
  id: SubsidiaryId;
  name: string;
  tagline: string;
  icon: LucideIcon;
  accent: "sky" | "iris" | "violet" | "cyan" | "amber" | "rose" | "emerald";
  state: LaunchState;
  categories: CategoryId[];
  domain: string;
  href: string;
  external: boolean;
  /** The platform this checkerboard of nodes is currently rendering. */
  current?: boolean;
};

export const SUBSIDIARIES: Subsidiary[] = [
  {
    id: "agency",
    name: "NDH Agency",
    tagline: "Digital strategy, design and delivery for growing businesses.",
    icon: BriefcaseBusiness,
    accent: "sky",
    state: "live",
    categories: ["enterprise"],
    domain: "agency.ndh.com.ng",
    href: "https://agency.ndh.com.ng",
    external: true,
  },
  {
    id: "academy",
    name: "NDH Academy",
    tagline: "Practical technology and business training for schools and teams.",
    icon: BookOpen,
    accent: "iris",
    state: "live",
    categories: ["education"],
    domain: "academy.ndh.com.ng",
    href: "https://academy.ndh.com.ng",
    external: true,
  },
  {
    id: "agricapital",
    name: "NDH AgriCapital",
    tagline: "Multi-commodity agricultural investment ledger and co-operative.",
    icon: Sprout,
    accent: "emerald",
    state: "live",
    categories: ["agriculture"],
    domain: "agricapital.ndh.com.ng",
    href: "/",
    external: false,
    current: true,
  },
  {
    id: "estore",
    name: "NDH eStore",
    tagline: "Everyday commerce and product fulfilment.",
    icon: ShoppingBag,
    accent: "amber",
    state: "live",
    categories: ["commerce"],
    domain: "estore.ndh.com.ng",
    href: "https://estore.ndh.com.ng",
    external: true,
  },
  {
    id: "schooldesk",
    name: "SchoolDesk",
    tagline: "School management and administration platform.",
    icon: School,
    accent: "cyan",
    state: "coming",
    categories: ["infrastructure"],
    domain: "schooldesk.ndh.com.ng",
    href: "",
    external: false,
  },
  {
    id: "travel",
    name: "NDH Travel",
    tagline: "Travel planning and booking support.",
    icon: Plane,
    accent: "emerald",
    state: "coming",
    categories: ["infrastructure"],
    domain: "travel.ndh.com.ng",
    href: "",
    external: false,
  },
  {
    id: "ihospital",
    name: "iHospital",
    tagline: "Connected care and health records.",
    icon: HeartPulse,
    accent: "rose",
    state: "coming",
    categories: ["infrastructure"],
    domain: "ihospital.ndh.com.ng",
    href: "",
    external: false,
  },
];

export const LIVE_SUBSIDIARY_COUNT = SUBSIDIARIES.filter((item) => item.state === "live").length;

/** Public contact details shared by the gateway header, footer and support. */
export const NDH_CONTACT = {
  legalName: "Najeeb Digital Hub",
  address: "Marmaron Nufawa Western Bye Pass, Sokoto, Nigeria",
  phone: "09029932794",
  telephone: "+2349029932794",
  email: "abunnajeeh7@gmail.com",
  support: "support@ndh.com.ng",
  whatsapp: "https://wa.me/2349029932794",
  map: "https://www.google.com/maps/search/?api=1&query=Marmaron%20Nufawa%20Western%20Bye%20Pass%20Sokoto%2C%20Nigeria",
  facebook: "https://www.facebook.com/share/1Be6HN8zjS/",
  instagram: "https://www.instagram.com/njb_digital_hub",
  parent: "https://ndh.com.ng",
} as const;

/** Where the AgriCapital farm operation is physically located (weather anchor). */
export const FARM_SITE = {
  label: "Tunga Magajiya outstation, Niger State",
  latitude: 9.6,
  longitude: 6.15,
  timezone: "Africa/Lagos",
} as const;
