# Mathematics Curriculum Linkage

WhackSmacker implements mathematics workbooks from the separate `math-curriculum` repository.

The curriculum repository is the canonical source for curriculum design. WhackSmacker records stable curriculum IDs and source document paths for traceability, but packaged WhackSmacker remains standalone and does not read from a local curriculum checkout at runtime.

Local absolute paths, such as `/home/ashwin/Projects/math-curriculum`, are development information only. They are not runtime dependencies.

## Unit Mapping

| Curriculum ID | Curriculum document | WhackSmacker command |
|---|---|---|
| `MATH-FOUNDATION-001` | `units/001-one-two-three.md` | `whacksmacker mathematics one-two-three` |
| `MATH-FOUNDATION-002` | `units/002-four-and-five.md` | `whacksmacker mathematics four-and-five` |
| `MATH-FOUNDATION-003` | `units/003-one-to-five.md` | `whacksmacker mathematics one-to-five` |
| `MATH-FOUNDATION-004` | `units/004-six-to-nine.md` | `whacksmacker mathematics six-to-nine` |

The `wsm` executable supports the same commands.

## Status Separation

Curriculum design status and software implementation status are separate.

The curriculum repository may mark a unit as specified before WhackSmacker implements or verifies it. WhackSmacker may generate, test, or visually validate a workbook without changing the curriculum design status.

## Runtime Behavior

Mathematics generation uses only the unit metadata and renderer code packaged with WhackSmacker.

It does not:

- open or parse files from `/home/ashwin/Projects/math-curriculum`;
- require the curriculum repository to be present;
- create a database;
- make network requests;
- contact AnkiConnect.
