/**
 * Four languages, one platform.
 *
 * Hausa matters most in the north where the farm sits, Yoruba and Igbo across
 * the south-west and south-east where most of the membership is. The switcher
 * carries the navigation, the hero, the three-step journey, the call to action
 * and the money labels — the parts a first-time visitor has to understand
 * before they can decide anything. Long-form legal and transparency copy stays
 * in English until a native speaker from the community has read the
 * translation, because a mistranslated risk statement is worse than an English
 * one somebody can see is English.
 *
 * No dependency, no context provider: the choice is stored in localStorage and
 * broadcast with a DOM event, so the header, the hero and the footer all update
 * together without threading a provider through every page.
 */
import { useCallback, useEffect, useState } from "react";

export type Locale = "en" | "ha" | "yo" | "ig";

export const LOCALES: { id: Locale; label: string; native: string; short: string }[] = [
  { id: "en", label: "English", native: "English", short: "EN" },
  { id: "ha", label: "Hausa", native: "Hausa", short: "HA" },
  { id: "yo", label: "Yoruba", native: "Yorùbá", short: "YO" },
  { id: "ig", label: "Igbo", native: "Igbo", short: "IG" },
];

export type CopyKey =
  | "nav.marketplace"
  | "nav.howItWorks"
  | "nav.transparency"
  | "nav.rules"
  | "nav.signIn"
  | "nav.portal"
  | "hero.badge"
  | "hero.headline"
  | "hero.headlineAccent"
  | "hero.sub"
  | "hero.ctaExplore"
  | "hero.ctaInvest"
  | "hero.ctaCalculator"
  | "opps.kicker"
  | "opps.title"
  | "opps.blurb"
  | "opps.target"
  | "opps.daysLeft"
  | "opps.timeline"
  | "opps.progress"
  | "opps.join"
  | "calc.kicker"
  | "calc.title"
  | "calc.amount"
  | "calc.estimate"
  | "calc.netReturn"
  | "calc.profitShare"
  | "calc.disclaimer"
  | "how.kicker"
  | "how.title"
  | "how.step1"
  | "how.step1Body"
  | "how.step2"
  | "how.step2Body"
  | "how.step3"
  | "how.step3Body"
  | "proof.kicker"
  | "proof.title"
  | "proof.blurb"
  | "whatsapp.title"
  | "whatsapp.body"
  | "whatsapp.cta"
  | "common.from"
  | "common.minimum"
  | "common.language"
  | "footer.support";

type Dictionary = Record<CopyKey, string>;

const EN: Dictionary = {
  "nav.marketplace": "Marketplace",
  "nav.howItWorks": "How it works",
  "nav.transparency": "Transparency register",
  "nav.rules": "Rules",
  "nav.signIn": "Member sign in",
  "nav.portal": "My portal",
  "hero.badge": "The agricultural investment ledger of Najeeb Digital Hub",
  "hero.headline": "Grow wealth through",
  "hero.headlineAccent": "real agriculture",
  "hero.sub":
    "Fund active farm batches, monitor daily photo logs, and earn harvest dividends with verified equity.",
  "hero.ctaExplore": "Explore active farms",
  "hero.ctaInvest": "Start investing",
  "hero.ctaCalculator": "Try the calculator",
  "opps.kicker": "Open farm opportunities",
  "opps.title": "Farm cycles you can join today",
  "opps.blurb":
    "Each card is a real batch on a real farm. The amount needed, the smallest ticket and the harvest date are fixed when the cycle opens — they do not move afterwards.",
  "opps.target": "Target capital",
  "opps.daysLeft": "Days remaining",
  "opps.timeline": "Expected timeline",
  "opps.progress": "Funding progress",
  "opps.join": "See this farm",
  "calc.kicker": "Return calculator",
  "calc.title": "What would my money do?",
  "calc.amount": "How much would you put in?",
  "calc.estimate": "Estimated return",
  "calc.netReturn": "Estimated net return",
  "calc.profitShare": "Your share of harvest profit",
  "calc.disclaimer":
    "An estimate only, run on the 70/30 harvest split. A farm can lose money; your capital is at risk.",
  "how.kicker": "How it works",
  "how.title": "Three steps, no small print",
  "how.step1": "Pick a farm",
  "how.step1Body":
    "Choose a batch you understand. Read its target, its timeline and every farm update already published.",
  "how.step2": "Fund once or monthly",
  "how.step2Body":
    "Put in from ₦5,000 once, or set a monthly Agri-Save plan and let it fund the next cycle for you.",
  "how.step3": "Receive harvest payout",
  "how.step3Body":
    "At harvest the books are settled in order — bills, members' capital, safety reserve, then profit.",
  "proof.kicker": "Farm photo proof",
  "proof.title": "Real work, photographed daily",
  "proof.blurb":
    "Feeding, sorting and biosecurity, photographed by the farm team and posted to member dashboards with the time they were taken.",
  "whatsapp.title": "Join 500+ investors in our official WhatsApp group",
  "whatsapp.body":
    "Daily video and photo updates straight from the farm, plus every expense the moment it is logged.",
  "whatsapp.cta": "Join the WhatsApp group",
  "common.from": "From",
  "common.minimum": "Minimum",
  "common.language": "Language",
  "footer.support": "Support",
};

const HA: Dictionary = {
  ...EN,
  "nav.marketplace": "Kasuwa",
  "nav.howItWorks": "Yadda yake aiki",
  "nav.transparency": "Rajistar gaskiya",
  "nav.rules": "Dokoki",
  "nav.signIn": "Shiga mamba",
  "nav.portal": "Ƙofata",
  "hero.badge": "Littafin zuba jari na noma na Najeeb Digital Hub",
  "hero.headline": "Haɓaka arziki ta hanyar",
  "hero.headlineAccent": "noma na gaske.",
  "hero.sub":
    "Ku tallafa wa rukunin gonaki masu aiki, ku duba hotunan yau da kullum, sannan ku sami rabon girbi tare da tabbataccen kaso.",
  "hero.ctaExplore": "Duba gonakin da ke aiki",
  "hero.ctaInvest": "Fara zuba jari",
  "hero.ctaCalculator": "Gwada lissafin",
  "opps.kicker": "Damar gonaki a buɗe",
  "opps.title": "Rukunin gona da za ku iya shiga yau",
  "opps.blurb":
    "Kowane kati wani rukuni ne na gaske a gonar gaske. Adadin da ake buƙata, ƙaramin kuɗin shiga da ranar girbi an ƙayyade su lokacin buɗe rukunin — ba sa canzawa.",
  "opps.target": "Adadin da ake buƙata",
  "opps.daysLeft": "Kwanaki da suka rage",
  "opps.timeline": "Tsawon lokaci",
  "opps.progress": "Ci gaban kuɗi",
  "opps.join": "Duba gonar",
  "calc.kicker": "Lissafin riba",
  "calc.title": "Menene kuɗina zai yi?",
  "calc.amount": "Nawa za ku saka?",
  "calc.estimate": "Ƙiyasin riba",
  "calc.netReturn": "Ƙiyasin riba mai tsabta",
  "calc.profitShare": "Rabon ku na ribar girbi",
  "calc.disclaimer":
    "Ƙiyasi ne kawai, bisa rabon girbi 70/30. Gona na iya yin asara; kuɗin ku na cikin haɗari.",
  "how.kicker": "Yadda yake aiki",
  "how.title": "Matakai uku, babu ruɗani",
  "how.step1": "Zaɓi gona",
  "how.step1Body":
    "Zaɓi rukunin da kuka fahimta. Karanta adadinsa, tsawon lokacinsa da duk bayanan da aka wallafa.",
  "how.step2": "Biya sau ɗaya ko kowane wata",
  "how.step2Body":
    "Saka daga ₦5,000 sau ɗaya, ko saita shirin Agri-Save na wata-wata ya biya muku rukuni na gaba.",
  "how.step3": "Karɓi rabon girbi",
  "how.step3Body":
    "Lokacin girbi ana biyan kuɗi bisa tsari — kuɗin kasuwa, kuɗin mambobi, ajiyar tsaro, sannan riba.",
  "proof.kicker": "Hoton gona",
  "proof.title": "Aiki na gaske, ana ɗaukar hoto kullum",
  "proof.blurb":
    "Ciyarwa, rabuwa da kariya daga cuta, ƙungiyar gona ce ke ɗaukar hoto sannan a aika zuwa allon membobi tare da lokacin da aka ɗauka.",
  "whatsapp.title": "Ku haɗa da masu zuba jari sama da 500 a rukunin WhatsApp na hukuma",
  "whatsapp.body":
    "Bidiyo da hotuna kullum daga gona, da kowane kuɗi da aka kashe da zarar an rubuta shi.",
  "whatsapp.cta": "Shiga rukunin WhatsApp",
  "common.from": "Daga",
  "common.minimum": "Mafi ƙaranci",
  "common.language": "Harshe",
  "footer.support": "Taimako",
};

const YO: Dictionary = {
  ...EN,
  "nav.marketplace": "Ọjà",
  "nav.howItWorks": "Bí ó ṣe ń ṣiṣẹ́",
  "nav.transparency": "Ìwé ìtọ́jú ìṣípayá",
  "nav.rules": "Àwọn ìlànà",
  "nav.signIn": "Wọlé ọmọ ẹgbẹ́",
  "nav.portal": "Ẹ̀ka mi",
  "hero.badge": "Ìwé ìdókòwò iṣẹ́ àgbẹ̀ ti Najeeb Digital Hub",
  "hero.headline": "Kí òrò ní àǹfààní nínú",
  "hero.headlineAccent": "iṣẹ́ àgbẹ̀ gidi.",
  "hero.sub":
    "Ṣètọ́jú àwọn ẹgbẹ́ oko tí wọ́n ń ṣiṣẹ́, wo àwọn fọ́tò ojoojúmọ́, kí o sì gba èrè ìkórè pẹ̀lú ìpín tí a fọwọ́ sí.",
  "hero.ctaExplore": "Wo àwọn oko tí ń ṣiṣẹ́",
  "hero.ctaInvest": "Bẹ̀rẹ̀ ìdókòwò",
  "hero.ctaCalculator": "Dan ìṣirò wo",
  "opps.kicker": "Àǹfààní oko tí ó ṣí",
  "opps.title": "Àwọn ẹgbẹ́ oko tí o lè dara pọ̀ mọ́ lónìí",
  "opps.blurb":
    "Kọ́ọ̀kì kọ̀ọ̀kan jẹ́ ẹgbẹ́ gidi ní oko gidi. Owó tí wọ́n nílò, owó tí ó kéré jùlọ àti ọjọ́ ìkórè ni a fi fìdí rẹ̀ mú nígbà tí ẹgbẹ́ ṣí — wọn kì í yí padà.",
  "opps.target": "Owó àfojúsùn",
  "opps.daysLeft": "Ọjọ́ tó kù",
  "opps.timeline": "Àkókò tí a retí",
  "opps.progress": "Ìlọsíwájú owó",
  "opps.join": "Wo oko yìí",
  "calc.kicker": "Ìṣirò èrè",
  "calc.title": "Kí ni owó mi yóò ṣe?",
  "calc.amount": "Èló ni ìwọ yóò fi sí?",
  "calc.estimate": "Èrè tí a retí",
  "calc.netReturn": "Èrè tí a retí lẹ́yìn gbogbo ìnáwó",
  "calc.profitShare": "Ìpín rẹ nínú èrè ìkórè",
  "calc.disclaimer": "Ìṣirò ni kìkì, lórí ìpín ìkórè 70/30. Oko lè pàdánù owó; owó rẹ wà nínú ewu.",
  "how.kicker": "Bí ó ṣe ń ṣiṣẹ́",
  "how.title": "Ìgbésẹ̀ mẹ́ta, kò sí ọ̀rọ̀ tí ó pamọ́",
  "how.step1": "Yan oko kan",
  "how.step1Body":
    "Yan ẹgbẹ́ tí o yé ọ. Ka owó àfojúsùn rẹ̀, àkókò rẹ̀ àti gbogbo ìròyìn oko tí a ti tẹ̀ jáde.",
  "how.step2": "Sanwó lẹ́ẹ̀kan tàbí lóṣooṣù",
  "how.step2Body":
    "Fi láti ₦5,000 lẹ́ẹ̀kan, tàbí ṣètò ètò Agri-Save oṣooṣù kí ó máa ṣètọ́jú ẹgbẹ́ tó ń bọ̀ fún ọ.",
  "how.step3": "Gba owó ìkórè",
  "how.step3Body":
    "Ní àkókò ìkórè a máa sanwó lẹ́sẹẹsẹ — owó àwọn tí a jẹ, owó àwọn ọmọ ẹgbẹ́, ìpamọ́ ààbò, lẹ́yìn náà èrè.",
  "proof.kicker": "Fọ́tò ẹ̀rí oko",
  "proof.title": "Iṣẹ́ gidi, tí a ń ya fọ́tò ojoojúmọ́",
  "proof.blurb":
    "Ìfúnjẹ, ìpínyà àti ààbò àrùn, ẹgbẹ́ oko ló ya fọ́tò rẹ̀, a sì fi í sí ojú-ìwé àwọn ọmọ ẹgbẹ́ pẹ̀lú àkókò tí a yà á.",
  "whatsapp.title": "Darapọ̀ mọ́ olùdókòwò tó ju 500 nínú ẹgbẹ́ WhatsApp ìjọba wa",
  "whatsapp.body":
    "Fídíò àti fọ́tò ojoojúmọ́ tààrà láti oko, pẹ̀lú gbogbo ìnáwó ní kété tí a kọ ọ́ sílẹ̀.",
  "whatsapp.cta": "Darapọ̀ mọ́ ẹgbẹ́ WhatsApp",
  "common.from": "Láti",
  "common.minimum": "Kéré jùlọ",
  "common.language": "Èdè",
  "footer.support": "Ìtìlẹ́yìn",
};

const IG: Dictionary = {
  ...EN,
  "nav.marketplace": "Ahịa",
  "nav.howItWorks": "Otu o si arụ ọrụ",
  "nav.transparency": "Akwụkwọ nghọta",
  "nav.rules": "Iwu",
  "nav.signIn": "Banye dịka onye otu",
  "nav.portal": "Ọnụ ụzọ m",
  "hero.badge": "Akwụkwọ itinye ego ọrụ ugbo nke Najeeb Digital Hub",
  "hero.headline": "Zụlite akụ̀ site n'",
  "hero.headlineAccent": "ọrụ ugbo dị adị.",
  "hero.sub":
    "Kwado otu ugbo na-arụ ọrụ, lelee foto kwa ụbọchị, nweta oke owuwe ihe ubi site na oke ego ekwenyere.",
  "hero.ctaExplore": "Lelee ugbo na-arụ ọrụ",
  "hero.ctaInvest": "Malite itinye ego",
  "hero.ctaCalculator": "Nwaa mgbako",
  "opps.kicker": "Ohere ugbo mepere emepe",
  "opps.title": "Otu ugbo ị nwere ike iso taa",
  "opps.blurb":
    "Kaadị ọ bụla bụ otu ugbo dị adị n'ugbo dị adị. Ego a chọrọ, obere ego ịbanye na ụbọchị owuwe ihe ubi ka edobere mgbe otu ahụ mepere — ha anaghị agbanwe.",
  "opps.target": "Ego ebumnuche",
  "opps.daysLeft": "Ụbọchị fọdụrụ",
  "opps.timeline": "Oge a tụrụ anya",
  "opps.progress": "Ọganihu ego",
  "opps.join": "Lee ugbo a",
  "calc.kicker": "Mgbako uru",
  "calc.title": "Gịnị ka ego m ga-eme?",
  "calc.amount": "Ego ole ka ị ga-etinye?",
  "calc.estimate": "Uru a tụrụ anya",
  "calc.netReturn": "Uru dị ọcha a tụrụ anya",
  "calc.profitShare": "Oke gị na uru owuwe ihe ubi",
  "calc.disclaimer":
    "Ọ bụ naanị atụmatụ, dabere na nkesa owuwe ihe ubi 70/30. Ugbo nwere ike ịla n'iyi; ego gị nọ n'ihe ize ndụ.",
  "how.kicker": "Otu o si arụ ọrụ",
  "how.title": "Nzọụkwụ atọ, enweghị okwu zoro ezo",
  "how.step1": "Họrọ ugbo",
  "how.step1Body":
    "Họrọ otu ị ghọtara. Gụọ ego ebumnuche ya, oge ya na ozi ugbo ọ bụla e bipụtara.",
  "how.step2": "Kwụọ otu ugboro ma ọ bụ kwa ọnwa",
  "how.step2Body":
    "Tinye site na ₦5,000 otu ugboro, ma ọ bụ debe atụmatụ Agri-Save kwa ọnwa ka ọ kwado otu na-abịa.",
  "how.step3": "Nata ego owuwe ihe ubi",
  "how.step3Body":
    "N'oge owuwe ihe ubi, a na-akwụ ụgwọ n'usoro — ụgwọ ahịa, ego ndị otu, ego nchekwa, mechaa uru.",
  "proof.kicker": "Foto akaebe ugbo",
  "proof.title": "Ọrụ dị adị, a na-ese foto kwa ụbọchị",
  "proof.blurb":
    "Inye nri, nhazi na nchekwa ọrịa, ndị otu ugbo na-ese foto ma wepụta ya na ebe ndị otu na-ahụ ya, tinyere oge e sere ya.",
  "whatsapp.title": "Sonye ndị itinye ego karịrị 500 na otu WhatsApp anyị",
  "whatsapp.body": "Vidio na foto kwa ụbọchị site n'ugbo, tinyere mmefu ọ bụla ozugbo edere ya.",
  "whatsapp.cta": "Sonye otu WhatsApp",
  "common.from": "Site na",
  "common.minimum": "Opekempe",
  "common.language": "Asụsụ",
  "footer.support": "Nkwado",
};

export const DICTIONARIES: Record<Locale, Dictionary> = { en: EN, ha: HA, yo: YO, ig: IG };

const STORAGE_KEY = "ndh.agricapital.locale";
const EVENT = "ndh:locale";

export function isLocale(value: string | null | undefined): value is Locale {
  return value === "en" || value === "ha" || value === "yo" || value === "ig";
}

function readStored(): Locale {
  if (typeof window === "undefined") return "en";
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isLocale(stored)) return stored;
    // First visit: honour the browser, if the browser speaks one of ours.
    const nav = window.navigator.language?.slice(0, 2).toLowerCase();
    if (isLocale(nav)) return nav;
  } catch {
    // Private mode, or storage disabled. English is a reasonable default.
  }
  return "en";
}

export function translate(locale: Locale, key: CopyKey): string {
  return DICTIONARIES[locale]?.[key] ?? DICTIONARIES.en[key] ?? key;
}

/**
 * The current language, and the means to change it.
 *
 * Both halves are exported together because every caller wants both: the copy
 * and the switch that changes it.
 */
export function useLocale() {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    setLocaleState(readStored());
    const onChange = (event: Event) => {
      const next = (event as CustomEvent<string>).detail;
      if (isLocale(next)) setLocaleState(next);
    };
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Nothing to do — the choice simply does not outlive the tab.
    }
    window.dispatchEvent(new CustomEvent(EVENT, { detail: next }));
    document.documentElement.lang = next;
  }, []);

  const t = useCallback((key: CopyKey) => translate(locale, key), [locale]);

  return { locale, setLocale, t };
}
