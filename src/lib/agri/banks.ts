/**
 * Nigerian banks, as a member sees them in a dropdown.
 *
 * The list is data, not a fetch: a payout account is entered on a phone in a
 * farm office, sometimes with one bar of signal, and a bank dropdown that needs
 * the network is a dropdown that fails. Names match the way they appear on a
 * Nigerian bank statement or transfer screen, because that is what a member
 * reads off when they check their own details.
 *
 * `code` is the NIBSS institution code, kept alongside the name for the day the
 * account-name lookup is wired to a provider that wants it. Nothing uses it yet
 * and nothing should invent a resolution from it.
 */

export type NigerianBank = { name: string; code: string };

export const NIGERIAN_BANKS: NigerianBank[] = [
  { name: "Access Bank", code: "044" },
  { name: "Access Bank (Diamond)", code: "063" },
  { name: "ALAT by Wema", code: "035" },
  { name: "Carbon", code: "565" },
  { name: "Citibank Nigeria", code: "023" },
  { name: "Ecobank Nigeria", code: "050" },
  { name: "Ekondo Microfinance Bank", code: "562" },
  { name: "Fidelity Bank", code: "070" },
  { name: "First Bank of Nigeria", code: "011" },
  { name: "First City Monument Bank (FCMB)", code: "214" },
  { name: "Globus Bank", code: "00103" },
  { name: "Guaranty Trust Bank (GTBank)", code: "058" },
  { name: "Heritage Bank", code: "030" },
  { name: "Jaiz Bank", code: "301" },
  { name: "Keystone Bank", code: "082" },
  { name: "Kuda Microfinance Bank", code: "50211" },
  { name: "Lotus Bank", code: "303" },
  { name: "Moniepoint Microfinance Bank", code: "50515" },
  { name: "Opay Digital Services", code: "999992" },
  { name: "Optimus Bank", code: "107" },
  { name: "Palmpay", code: "999991" },
  { name: "Parallex Bank", code: "104" },
  { name: "Polaris Bank", code: "076" },
  { name: "Premium Trust Bank", code: "105" },
  { name: "Providus Bank", code: "101" },
  { name: "Stanbic IBTC Bank", code: "221" },
  { name: "Standard Chartered Bank", code: "068" },
  { name: "Sterling Bank", code: "232" },
  { name: "SunTrust Bank", code: "100" },
  { name: "Taj Bank", code: "302" },
  { name: "Titan Trust Bank", code: "102" },
  { name: "Union Bank of Nigeria", code: "032" },
  { name: "United Bank for Africa (UBA)", code: "033" },
  { name: "Unity Bank", code: "215" },
  { name: "Wema Bank", code: "035" },
  { name: "Zenith Bank", code: "057" },
];

/** A quick lookup for rendering a stored bank name back into the dropdown. */
export function isKnownBank(name: string | null | undefined): boolean {
  if (!name) return false;
  return NIGERIAN_BANKS.some((bank) => bank.name === name);
}
