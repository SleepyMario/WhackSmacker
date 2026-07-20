# Language Curriculum Policy

These rules are hard WhackSmacker language-curriculum constraints. They apply to normal language core chapters and normal core review decks.

## Canonical cumulative continuity from Chapter 1

For every chapter through Chapter 140, continuity begins at Chapter 1 and
includes the complete state through the immediately preceding chapter. The
immediate predecessor is the newest part of that state, not its sole source.
Five-chapter blocks, review decks, grammar summaries, units, packages, and
installation boundaries never reset grammar, vocabulary, lexical/sense
identity, first-introduction chapters, verb metadata, encountered forms,
noun/article state, cast and relationship history, topic history,
broader-topic reuse, or cumulative difficulty. Validation processes chapters in
one ordered Chapter-1-origin sequence and rejects missing earlier state.

## Canonical cast and active cast

Language packages preserve the complete thirty-person `canonical-cast.json`,
including its versioned `activeCast.progression`. That explicit list is a
permutation of all thirty canonical IDs; cast-array, object, and filesystem
order are never activation order.

For chapter `c`, the active prefix length is
`min(30, 5 + 3 × floor((c - 1) / 20))`. Chapters 1-20 therefore permit 5
people, Chapters 21-40 permit 8, and every twenty-chapter boundary adds exactly
3 through 29 in Chapters 161-180. Chapter 181 adds only the remaining thirtieth
person. Chapter 201 onward stays at those same 30. Earlier
people remain active permanently and no thirty-first identity is allowed.

Participant declarations, speaker IDs, narrative subject/narrator IDs,
learner-facing content, cast-assignment metadata, and reviews are checked.
Reviews can only reuse IDs present in declared source chapters. Ordinary proper
nouns are not cast identities unless explicitly assigned a canonical ID.

Appearance auditing reports counts by chapter, twenty-chapter block, and
cumulatively. Generation prefers least-used suitable active people; recurring
relationships remain valid, and only severe imbalance warns. Unknown and early
inactive IDs hard-fail. Legacy records may explicitly remain
`pending-legacy-migration`; new records cannot claim that status.

Completed activation blocks have two independent meaningful-use requirements.
Every newly activated person, including each initial person, participates in at
least five distinct ordinary chapters during their first activation block. Each
person counts once per chapter regardless of line count. Every completed
post-initial block also requires old-cast appearances to be at least
`ceil(total meaningful canonical person-chapter appearances / 3)`. This
supersedes the former one-older-person minimum. Metadata,
ledgers, titles, grammar notes, cast files, bare speaker labels, and review-only
references do not satisfy coverage. Incomplete blocks report new-person chapter
lists/counts/remaining-to-five and old/new/total ratio data with `pending`
status; they do not fail merely because future chapters are absent. Completed
shortfalls hard-fail. After Chapter 200, activation and old/new accounting cease
entirely. Severe concentration and long-term imbalance auditing may continue.

From Chapter 201, chapters may use ID-less, lightly described functional role
characters when a setting requires them. They do not enter the progression,
active totals, relationship graphs, or balancing. Adding a canonical ID or
substantial biography, relationships, personality, recurring personal plot, or
long-term continuity is a blocking hidden-cast violation. Before Chapter 201,
fictional incidental people remain prohibited except where another policy
already permits a non-cast real, historical, literary, or public figure.

## Chapter 1 lexical systems and learner-facing vocabulary

Languages with multiple definite articles, grammatical gender, noun classes,
or a comparable category system establish that foundation in Chapter 1. The
chapter teaches the citation-form definite articles, learning nouns with their
article, and any elision or syncretism that hides category information. Dutch
requires `de`/`het`, German `der`/`die`/`das`, French `le`/`la`/`l’` plus marker
guidance, and Spanish its definite-article/gender system. Do not invent gender
for English, Chinese, Japanese, Korean, Vietnamese, or another language without
it. This mandatory lexical guidance may be the principal grammar point or may
coexist with it; it does not automatically count as a second principal point.

Applicable isolated noun vocabulary uses the article-bearing citation form in
chapter vocabulary, chapter/cumulative ledgers, isolated reviews, grammar
summary vocabulary lists, and generated indexes. Internal data may retain a
bare lemma and records the definite article, grammatical category, marker
requirement, and exceptional/plural-only status. Use dictionary case, do not
prepend articles to non-nouns or running text, and add `M`, `F`, or `N` when an
elided/syncretic display hides the category (`l’eau (F)`). Other noun-class
systems use stable language-specific labels.

Grammatical measure-word/classifier/counter records preserve lexical form,
learner-facing form, optional pronunciation, grammatical type (`MW`,
`classifier`, or `counter`), concise semantic scope, representative noun
classes, restrictions, and usage status. Scope appears in every isolated
learner-facing listing and survives package/index generation. `M` is reserved
for masculine. Transparent ordinary measures such as spoonful, glass, kilo, or
box remain simple vocabulary unless their selection is grammaticalized and
must be memorized.

## Lexical identity, verb forms, and expressions

### Canonical lexical-topic expansion

A practical lexical topic begins when its first canonical sense appears in
learner-facing Dialogue or Narrative content. Register that topic, its first
attested chapter, and the anchor sense immediately. A topic may remain
represented by one sense for any number of chapters: there is no expansion
quota, deadline, required interval, or penalty for deferral.

Expansion continues incrementally in later natural chapters. Every newly
introduced anchor or expansion sense must have a literal learner-facing
attestation, one to three literal examples, stable lexical-entry and sense IDs,
chapter-ledger and cumulative-ledger entries, and exactly one card in each
direction in the five-chapter review block containing its first introduction.
Reinforcement keeps its original first-introduction chapter and does not count
as new or enter a later review block.

Repositories keep a versioned `lexical-topics.json` inventory with stable
topic IDs, display names, first attested chapters and senses,
anchor/initial/later senses, descriptive status, and chapter attestations.
Allowed statuses are `observed`, `active`, `expanding`, and
`well-established`; none closes a topic or imposes an expansion schedule.
Canonical sense metadata may additionally carry
`lexical_topic`, `topic_role`, `topic_first_chapter`, and
`topic_expansion_stage`; `topic_role` is one of `anchor`,
`initial-expansion`, `later-expansion`, or `reinforcement`.

The following remain distinct internal topics even when closely related:
measurement units, container nouns, classifiers/counters, quantity
expressions, and dimension/weight vocabulary. Language-specific citation,
article, classifier, regional-variant, and lexical-identity rules continue to
apply. Regional variants share an identity only when they are variants of the
same lexical sense; culturally or semantically distinct words retain distinct
identities.

A canonical sense may be assigned to more than one genuinely applicable topic
without creating a second lexical sense or a second review card. Topic
membership is classification metadata and never changes lexical identity or
review eligibility.

Canonical vocabulary distinguishes surface form, lemma/citation form, part of
speech, stable lexical-entry ID, stable sense ID, meaning, introduction status,
first-introduction chapter, encountered forms, related senses, and later
attestations. Identical spelling does not merge unrelated senses. Predictable
inflection, agreement, article display, diminutive formation, spelling or
pronunciation variation, and contextual reuse do not create new senses.

An inflected, contracted, polite, or otherwise non-citation verb encounter links
to the language's normal infinitive or other citation form. The encounter and lemma are
one introduction: Dutch `klopt` → `kloppen`, English `does` → `do`, Korean `해`
→ `하다`, and Japanese `します` → `する`. Use `infinitive` only where that concept
applies; otherwise use the language's appropriate citation convention.

Lexicalized multiword expressions receive independent entry and sense IDs under
their complete citation form. Reviews test the whole expression rather than a
component falsely assigned the idiomatic meaning. Internal morphology is
productive-and-known, supporting, fixed-or-unanalyzed, or not-yet-taught; a
fixed expression cannot silently introduce an undeclared productive rule.

Review, reintroduced, previously introduced, and reuse records retain the
original first-introduction chapter and do not count as new vocabulary. New
entries, genuinely distinct senses, new parts of speech, and complete new
multiword expressions count once. Semantic boundaries and lexicalization remain
subject to human linguistic review, never automatic inference from prose.

## Learner-facing lexical display

Normal learner-facing vocabulary Notes use accessible concise labels: `Noun`, `Verb`, `Infinitive`,
`Adjective`, `Adverb`, `Preposition`, `Conjunction`, `Pronoun`, `Numeral`, `Phrase`, `Sequence word`, `Classifier`,
`Counter`, or `Measure word`. They do not expose lemma, lexical-entry or sense
IDs, surface/citation-form terminology, introduction status, first-introduction
chapter, attestations, or morphology classifications. Internal structured
metadata retains all of those fields.

Expert read-content Notes may replace a broad category with a concise,
linguistically accurate subclass only when the current row's authored or
structured data supports it. Unsupported classifications remain broad.
Developer may retain raw fields. This display refinement never rewrites review
decks.

Normal reading vocabulary lists do not display the raw structured `Usage`
field. It remains available for authoring, validation, lexical disambiguation,
generation, debugging, and advanced inspection. Rewrite any distinction that
learners genuinely need as clear learner-facing prose.

When an encountered verb differs meaningfully from its infinitive in a language
where that concept applies, keep the encounter primary. Directly below it, put
the bare infinitive in the lexical/form column, its natural English infinitive
in the translation column, and exactly `Infinitive` in Notes. Do not insert a
separator between these rows. They remain one lexical introduction and share
lexical and sense identity.

Never prefix this row with `INF:` or `DF:`, and never use learner-facing
`dictionary form`. Omit the row when the display is already the infinitive, the
mapping adds no learner value, or the language has no applicable infinitive.
Such languages retain their own citation-form convention and must not receive
an invented infinitive.

## Normal-view instructional voice

Normal-view instructional prose addresses the reader directly, normally with
`you`; refers neutrally to the language, construction, sentence, form, example,
or exercise; or uses an ordinary imperative such as `Use`, `Notice`, or
`Compare`. It does not describe the reader with detached third-person labels
such as `the learner`, `learners`, `the student`, `students`, or `the user`.

This check applies to instructional prose, not genuine people in dialogue,
narrative, or quoted examples. Developer view may retain complete original
authoring, validator, and technical wording inside structurally classified
developer-only blocks.

### Audience-specific language notes

Vietnamese ordinary reading support projects usage, spelling, word-boundary,
register, address-form, classifier, particle, and natural-phrasing sections
under the exact Normal heading `Language Notes`. The authoritative support
record uses `audienceSections[].normalHeading`; Expert retains the source
heading and technical explanation, while Developer exposes the separate Normal
and Expert support blocks. A `null` Normal heading may continue a preceding
`Language Notes` section without merging the source records internally.

Normal language-note prose uses short direct sentences, defines unavoidable
terms immediately, and favors concrete Vietnamese examples. A chapter without
an applicable source note does not receive an empty section.

## Canonical verb regularity

At first introduction, every canonical verb sense stores `regularityStatus`:
`regular`, `irregular`, `not-applicable`, or temporary migration
`undetermined`. It may also store a language-specific `verbClass`. Applicable
new or reviewed verbs resolve to regular/irregular; ordinary Chinese verbs and
other systems without a meaningful distinction use not-applicable. Undetermined
is reserved for pending legacy migration.

The normalized field does not replace real language categories. `verbClass`
may preserve strong/weak, conjugation, stem-changing, separable/inseparable,
Japanese, Korean irregular, or another established class. Encounter/dictionary
form differences, predictable phonology or spelling, politeness, agreement,
regular inflection, and normal separability do not independently imply
irregularity.

Later inflected encounters, review, reuse, and reintroduction inherit the first
record's status/class and remain one lexical entry. Incompatible changes fail
validation unless explicitly audited as a correction. The fields survive
ledgers, structured vocabulary, packages, installation, memorization items,
reviews, reintroductions, and internal indexes. They do not appear in
learner-facing Notes, which remain `Verb` plus the applicable DF line.

Existing curricula are pending language-by-language migration; this policy does
not mutate their repositories automatically.

## Pacing

Chapters 1-25:

- 1 main grammar point per chapter.
- 6-20 lines of read content per chapter.
- 6-10 new vocabulary items per chapter.

Chapters 26-30:

- 1-2 main grammar patterns per chapter.
- 10-30 lines of read content per chapter.
- 6-20 new vocabulary items per chapter.

Chapters 31-50:

- exactly 2 genuinely new principal grammar points per chapter;
- exactly 1 connector, conjunction, linking form, sequencing construction, or comparable discourse-linking point;
- exactly 1 genuinely new point from a different broad grammatical domain;
- 10-30 learner-facing read lines and 6-20 genuinely new vocabulary items;
- topic-centred content and odd dialogue / even narrative.

Two connector-domain points fail. Reused grammar satisfies neither slot, and
supporting morphology, agreement, pronunciation, spelling, or required
inflectional variants do not increase the count. The Chapters 41-50 numbers and
quantity focus remains content inside this unified grammar stage, not a separate
grammar band.

Chapters 51-70:

- exactly 2 genuinely new principal grammar points per chapter;
- 15-30 learner-facing dialogue or narrative lines;
- 10-30 genuinely new learner-facing vocabulary items;
- odd dialogue / even narrative and topic-centred content.

Chapters 31-70 are intentionally the steepest grammar-acquisition section.
Chapters 51-70 concentrate on language-appropriate tense, time reference,
aspect, event structure, mood, and modality. Both points must be new,
compatible, and subordinate to a coherent chapter topic. Supporting
morphology, agreement, pronunciation, spelling, and required inflectional
variants do not count separately. Reused grammar satisfies neither point. Do
not force English tense categories onto languages organized differently or
combine two extremely difficult distinctions from one narrow subsystem unless
the language requires them together.

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

In `New Grammar`, use `Principal: ID | description`, `Supporting: ID |
description`, and `Reused: ID | description`. Each chapter must contain exactly
two stable principal IDs not introduced earlier. Supporting and reused entries
never inflate or satisfy the count.

## Expanded Grammar and Broader Discourse: Chapters 71-140

Chapters 71-140 form one seventy-chapter stage. Each chapter introduces exactly
one genuinely new principal grammar point, 10-30 genuinely new learner-facing
vocabulary items, and 20-40 learner-facing dialogue or narrative lines.

This is a transition to slower new-grammar intake, not easier content. Increase
text length, discourse complexity, clause depth, topic breadth, cumulative
reuse, negation and question complexity, integrated tense/time/aspect/mood/
modality, and diminutive systems where applicable. The overall progression is
Chapters 1-30 foundation and transition, Chapters 31-70 the steep grammar hill,
and Chapters 71-140 deeper integration with more advanced reading.

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

Every visible top-level read-content heading is exactly `Grammar`. Normal
selects Easy, Expert selects Hard, and Developer presents both inside one
`Grammar` section with internal `Normal` and `Expert` labels. Never render a
top-level heading named `Grammar Easy`, `Grammar Hard`, `Grammar: Normal`, or
`Grammar: Expert`; redundant nested `Grammar Point` or `Grammar Points`
wrappers are omitted.

Numbered Foundation menu entries use exact derived labels of the form
`Foundation Chapter -- N`. Only `Foundation` receives the chapter-token color;
the remainder uses ordinary menu-label styling and no extra `Chapter` prefix.

Normal review answers should store the concise learner meaning without terminal
technical suffixes such as `in the taught frame`, `in the attested frame`, or
`in the licensed construction`. Normal projection removes those suffixes from
legacy content as a compatibility guard. Expert and Developer may retain
precise wording where it remains useful. Card identity, examples, provenance,
scheduling, and progress remain unchanged when answer wording is clarified.

Grammar Easy addresses the learner directly using language understandable to
someone roughly at US grade levels 4-8. It uses short, concrete explanations
and examples, avoids detached references such as `the learner`, `learners`,
`the student`, `students`, or `the user`, and remains technically accurate.
Grammar Easy and Grammar Hard retain the same canonical grammar ID and exact
learner-facing pattern for every shared point.

Every grammar record keeps `grammarId`, `learnerFacingPattern`,
`learnerFacingExplanation`, and optional `developerDescription` separate.
Chapter headings and Easy/Hard inventories render the learner-facing pattern;
they never fall back to the developer description. Easy and Hard must use the
same pattern identity for a shared grammar ID.

When structured components form a compositional pattern, render them with
exactly ` + ` between components, such as `clause + en + clause`,
`subject + verb + object`, or `topic + は + comment`. Do not use unspaced plus
signs, repeated spaces, arrows, or prose descriptions in the pattern position.
Fixed indivisible expressions remain whole. Components are declared, not
inferred from arbitrary prose, and their pedagogical form remains subject to
human review.

## Strict Review Examples

One normal vocabulary review deck follows each completed consecutive
five-chapter block. Its size is derived from the canonical lexical inventory:
it contains exactly one card for every vocabulary item or lexical sense first
introduced in that block, with no fixed card count. Reused vocabulary retains
its earlier first-introduction chapter and does not enter a later deck again.

Each normal card prompts in the target language and answers in the source
language. Normal vocabulary decks contain no reverse duplicates, grammar or
comprehension questions, cloze or multiple-choice questions, production
exercises, or distractors.

Normal learner-facing five-chapter review decks do not render the raw
structured `Notes` field or a `Notes:` section. The metadata remains available
for authorship, validation, provenance, migrations, and debugging.

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

## Chapter introduction roles

`Brief Introduction` is reserved for a concise explanation of the principal
grammar pattern or construction taught in the chapter and what it enables. It
must not carry character, relationship, plot, or setting exposition.

Every primary Dialogue or Narrative starts with a separate short scene
introduction immediately below its reading heading. That introduction identifies
the people or narrative subject and establishes the setting or situation before
the canonical reading body.

Natural English Translation contains only translated dialogue turns or narrative
sentences. It starts immediately with translated reading content and never
repeats or invents a grammar introduction, scene introduction, participant
introduction, or context paragraph. Structured translation sidecars containing
such prefatory fields are rejected.

## CLI learner-reading colors

The CLI renderer enforces one global semantic presentation rule across all
language packages: dialogue speaker labels, including their colons, are purple;
spoken target-language utterances are pink; and learner-facing target-language
narrative prose is pink. The speaker-label purple ends at the colon, so an
entire dialogue line is never made purple.

Natural English translations, Source-language support, headings, vocabulary,
grammar, exercises, and review metadata do not inherit the target-reading pink
or speaker-label purple. These colors are renderer-only: curriculum sources and
generated packages contain no ANSI styling. `NO_COLOR` and non-TTY output emit
the same content and layout without ANSI escapes.

## CLI translation visibility

The far-right Toggles pane has independent `Source` and `Translation`
controls. Source selects the language for interface text, explanations,
headings, grammar descriptions, and other localized learner support.
`Translation: Off` or `Translation: On` controls only whether the natural
English translation of target-language dialogue or narrative is shown directly
in the normal output pane.

The reading translation remains English for every Source selection.
Translation defaults to off for each fresh CLI session, and changing either
control does not change the other. The toggle remains visible when a chapter
lacks a translation; no Source overlay may substitute for missing natural
English translation content. Target-language content stays visible in both
states. The default protects immersion and keeps the target language primary.
