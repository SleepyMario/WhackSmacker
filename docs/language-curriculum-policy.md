# Language Curriculum Policy

These rules are hard WhackSmacker language-curriculum constraints. They apply to normal language core chapters and normal core review decks.

## Pacing

Chapters 1-25:

- 1 main grammar point per chapter.
- 6-20 lines of read content per chapter.
- 6-10 new vocabulary items per chapter.

Chapters 26-50:

- 1-2 main grammar patterns per chapter.
- 10-30 lines of read content per chapter.
- 6-20 new vocabulary items per chapter.

Chapter 51 remains a pacing decision boundary. Do not invent a new pacing band
automatically after Chapter 50. The number-continuation requirements below are
an explicit, limited exception.

## Number Continuation: Chapters 51-70

Numbers may be used freely in every chapter. There is no restriction on using
numbers below, within, or above the ranges specified here.

Each five-chapter block must cumulatively introduce and use at least one
learner-facing number in its assigned range:

- Chapters 51-55: 100-999.
- Chapters 56-60: 100-999.
- Chapters 61-65: 1000-9999.
- Chapters 66-70: 1000-9999.

The qualifying number may occur in any single chapter in its block; it is not
required in every chapter. It must appear naturally in learner-facing dialogue
or narrative content. Numbers found only in metadata, validation fixtures,
grammar explanations, generated notes, vocabulary bookkeeping, or review
material do not qualify.

These are minimum coverage rules only: numbers of any value remain permitted
throughout Chapters 51-70. Handle language-specific number formation,
classifiers, counters, agreement, case marking, irregular forms, and parallel
number systems naturally where relevant.

## Chapter Size: Chapters 51-70

Every chapter must introduce 10-30 genuinely new learner-facing vocabulary
items and contain 15-30 learner-facing dialogue or narrative lines.

Only explicitly introduced `New Vocabulary` entries count, after excluding
duplicates within the chapter and items introduced earlier in the curriculum.
Do not count earlier vocabulary reuse, grammar labels, metadata, developer
notes, generated explanatory text, review-only material, or words found only
outside learner-facing curriculum content.

Count only actual learner-facing dialogue or narrative lines. Exclude titles,
headings, speaker names without accompanying dialogue, vocabulary entries,
grammar explanations, metadata, developer notes, review exercises, generated
summaries, blank lines, and structural separators.

Odd-numbered Chapters 51-70 remain dialogues; even-numbered Chapters 51-70
remain narratives.

## Expanded Grammar and Broader Discourse: Chapters 71-140

Chapters 71-140 form one seventy-chapter stage. Each chapter introduces exactly
one genuinely new principal grammar point, 10-30 genuinely new learner-facing
vocabulary items, and 20-40 learner-facing dialogue or narrative lines.

In `New Grammar`, declare each bullet as `Principal: ID | description`,
`Supporting: ID | description`, or `Reused: ID | description`. The stable ID,
not the amount of explanatory prose or the number of forms shown, determines
identity. Exactly one `Principal` ID must be new to the cumulative curriculum.
Supporting morphology, agreement, spelling, pronunciation, and required
inflectional variants of that construction do not count separately. An ID
introduced in an earlier chapter is reused even if it is mistakenly labelled
principal and cannot satisfy the new-point requirement.

Vocabulary counting uses unique entries explicitly declared under learner-facing
`New Vocabulary`, excluding duplicates and entries introduced earlier. Content
outside that section never inflates the count. Line counting uses only nonblank
content lines in the learner-facing dialogue or narrative block and excludes
titles, headings, bare speaker labels, vocabulary and grammar material,
metadata, notes, reviews, summaries, separators, and structural markup.

Odd chapters are practical, topic-centred dialogues. They declare a concrete
`communicative_situation`, use at least two named speakers, reject generic
`A/B/C` labels, and remain recognizably conversational. Even chapters are
topic-centred narratives whose read content remains primarily prose. They
declare `narrative_scope: concrete-real-life` or `broader` and
`learner_accessible: true`.

The thirty-five narratives split as evenly as possible: either 18
concrete-real-life / 17 broader or 17 concrete-real-life / 18 broader. A
broader narrative also declares one canonical `broader_topic_domain`: `social`,
`cultural`, `ethical`, `institutional`, `environmental`, or `conceptual`.
Broader topics use the canonical definition: broader social, cultural, ethical,
institutional, environmental, or conceptual subjects that can still be
discussed at the learner's level. No more than three consecutive narrative
chapters may be broader, preventing pathological clustering.

Continue tense, aspect, mood, modality, time reference, and event structure;
increase emphasis on clause structure and combining; and expand interrogative
constructions, negation, and negation scope. These are distributed coverage
domains, not a universal sequence. Their exact realization and terminology
remain language-adaptive and must not force English categories onto other
languages. Grammar remains subordinate to the chapter topic.

Where relevant, coverage extends through completion, duration, frequency,
habituality, iteration, progressive, perfective/imperfective,
perfect/resultative, inception, continuation, termination, ability,
possibility, probability, certainty, permission, obligation, necessity,
prohibition, advice, intention, volition, wishes, hypothetical and
counterfactual meanings. Clause work includes coordination, subordination,
complements, relatives, adverbials, temporal/purpose/reason/result/concessive/
conditional clauses, embedding, chaining, participial and converbal forms,
serial verbs, and other language-specific mechanisms. Question and negation
coverage retains the complete canonical inventory without prescribing a fixed
chapter order.

Produce `Grammar - Easy` and `Grammar - Hard` after Chapters 75, 80, 85, 90,
95, 100, 105, 110, 115, 120, 125, 130, 135, and 140. Each pair covers only the grammar
actually introduced in its own five-chapter block.

## Broader-topic inventory

Every broader narrative declares `broader_topic_id` and resolves it against the
separate `units/broader-topic-inventory.json`. The JSON Schema is
`schemas/broader-topic-inventory-v1.schema.json`. IDs are stable lowercase
slugs independent of chapter titles, so variant phrasings of the same topic map
to one identity.

Records contain a canonical name, primary and optional additional canonical
domains, first-introduction chapter and content type, learner-level description,
later uses, and derived narrative/dialogue meaningful-reuse booleans. Later
uses distinguish `meaningful-reuse` from `incidental-mention`. Only meaningful
reuse contributes to reuse state. First introduction must be a broader
narrative; later narrative reuse must be explicitly recorded. Dialogue reuse is
supported by the schema but is not required in Chapters 71-140. Concrete
narratives need no broader-topic record.

## Time, date, year, and large-number continuation

Stage-wide coverage is validated when Chapter 140 is present. At least five
distinct chapters declare `time_date_evidence`, and each declared literal form
must occur inside learner-facing dialogue or narrative content.

Year requires at least one `year_use: introduction` or `year_use: review`, plus
at least two additional `year_use: reuse` chapters. Every use supplies literal
`year_evidence` found in read content. Normal inflected, declined,
classifier-attached, counter-marked, and other language-specific surface forms
qualify. The qualifying chapters must span at least two five-chapter blocks.

Large-number use is declared as
`large_number_evidence: canonical-value | literal surface form`; multiple uses
are separated by semicolons. The surface form must occur in read content. This
allows language-specific ten-thousand or hundred-million organization while
retaining a canonical numeric value for inclusive range validation.

Independent minimum blocks are:

- Chapters 71-80: 9,999-10,000;
- Chapters 81-90: 99,999-100,000;
- Chapters 91-100: 9,999,999-10,000,000;
- Chapters 101-110: 99,999,999-100,000,000;
- Chapters 110-120: 999,999,999-1,000,000,000.

Chapter 110 participates independently in both overlapping blocks. Numbers of
all other values remain permitted, and Chapters 121-140 have no additional
large-number minimum. Metadata-only declarations never qualify because every
evidence form is checked against learner-facing content.

## Odd/Even Format

All normal language core chapters follow this hard format rule:

- odd-numbered chapters are dialogues;
- even-numbered chapters are narratives.

The rule applies across all languages and all chapter ranges. Chapter 26 onward
remains topic-centered: odd chapters are topic-centered dialogues, and even
chapters are topic-centered narratives. Grammar progression must fit the
required format.

## Vocabulary Continuity

- Only Chapter 1 may establish the initial base vocabulary.
- Later chapters build cumulatively on previous chapters.
- Chapter 6, Chapter 11, Chapter 16, and later five-chapter block starts must not reset vocabulary.
- New vocabulary after Chapter 1 must be deliberate and supported by read content or clear curriculum progression.
- Country and place vocabulary expansion still stands, but country and place vocabulary must be worked into read content before it becomes normal core review content.

## Grammar Summaries

After each 5-chapter block, add two grammar summary readable-content entries:

- `Grammar - Easy`
- `Grammar - Hard`

Both entries cover the same grammar inventory and technical content. The Easy version explains the same points in simpler language; the Hard version stays compact and technical.

## Strict Review Examples

Normal core review entries require 100% strict read-content example coverage:

- minimum 1 example;
- maximum 3 examples;
- literal sentences from read content only;
- no invented examples;
- no vocabulary-list examples;
- no grammar-explanation examples;
- no metadata, notes, generated fields, or internal strings.

Changed surface forms can satisfy matching when they are normal for the language: conjugated forms, inflected forms, particle-attached forms, plural or declined forms, tone changes, sandhi, phonological changes, and other language-specific surface forms.

Preserve the read-content sentence exactly. Do not rewrite it to dictionary or base form.
