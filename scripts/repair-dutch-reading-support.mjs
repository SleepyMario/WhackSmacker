#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const root = new URL("../curriculum-support/dutch/", import.meta.url);

const replacements = new Map([
  ["Door de aubergine en courgette te marineren, krijgen ze meer smaak.", "Door de aubergine en courgette te marineren, geven we ze meer smaak."],
  ["Door de kikkererwten fijn te maken, wordt de vulling steviger.", "Door de kikkererwten fijn te maken, maak ik de vulling steviger."],
  ["By marinating the aubergine and courgette, they get more flavour.", "By marinating the aubergine and courgette, we give them more flavour."],
  ["By mashing the chickpeas finely, the filling becomes firmer.", "By mashing the chickpeas finely, I make the filling firmer."],
  ["Haar figuur lijkt alsof het nieuwsgierig naar de kom kijkt.", "Het lijkt alsof haar figuur nieuwsgierig naar de kom kijkt."],
  ["Her figure looks as if it is staring curiously at the bowl.", "It looks as though her figure is looking curiously at the bowl."],
  ["De bodem staat vlak en de kleine barst die Lotte vreesde, is niet ontstaan.", "De bodem is vlak en de kleine barst die Lotte vreesde, is niet ontstaan."],
  ["The base stands flat and the small crack that Lotte feared has not appeared.", "The base is flat and the small crack that Lotte feared has not appeared."],
  ["Het lampje van het wifi-signaal blijft rood knipperen.", "Het wifi-lampje op de router blijft rood knipperen."],
  ["The Wi-Fi signal light keeps blinking red.", "The Wi-Fi light on the router keeps blinking red."],
  ["Laat de systeemupdate voorlopig wachten.", "Stel de systeemupdate voorlopig uit."],
  ["Let the system update wait for now.", "Postpone the system update for now."],
  ["Mocht iemand vanavond niets horen, dan controleren we eerst de eigen instellingen.", "Mocht iemand vanavond niets horen, dan controleren we eerst de instellingen van dat apparaat."],
  ["If someone cannot hear anything tonight, we will first check their own settings.", "If someone cannot hear anything tonight, we will first check that device's settings."],
]);

function mapStrings(value, transform) {
  if (typeof value === "string") return transform(value);
  if (Array.isArray(value)) return value.map((item) => mapStrings(item, transform));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, mapStrings(item, transform)]));
  }
  return value;
}

function synchronize(text) {
  let result = text.replaceAll(" The grammar IDs remain distinct and cumulative.", "");
  for (const [before, after] of replacements) result = result.replaceAll(before, after);
  return result;
}

for (let chapter = 1; chapter <= 80; chapter += 1) {
  const directory = `chapter-${String(chapter).padStart(3, "0")}`;
  const path = join(root.pathname, directory, "reading-support.json");
  let document = JSON.parse(await readFile(path, "utf8"));
  document = mapStrings(document, synchronize);

  if (chapter >= 71) {
    document.semanticSpanPolicyVersion = 1;
    for (const section of document.audienceSections) {
      for (const audience of ["normal", "expert"]) {
        section[audience] = section[audience].replace(/\[\[grammar:([^\]\n]*[.!?])\]\]/gu, "$1");
      }
    }
    for (const audience of ["normal", "expert"]) {
      document.breakdown[audience] = document.breakdown[audience].replace(/\[\[grammar:([^\]]+)\]\]/gu, "$1");
    }
  }

  await writeFile(path, `${JSON.stringify(document, null, 2)}\n`);
}

console.log("Repaired Dutch reading support for chapters 1-80; constrained semantic spans in chapters 71-80.");
