# Calibration

AI coaching scores are only useful if they roughly agree with an experienced mentor. Calibration is the practice of scoring the same sessions twice, once by Firefly and once by a person, and looking at where the two differ.

Firefly does not claim any level of agreement. Every number it shows is computed from records you stored, and with a small number of records it says so.

## How to calibrate

1. **Pick completed sessions** that cover different scenarios and difficulties. Use fictional practice calls only.
2. **Have a mentor score each session blind.** The mentor reads the transcript and scores the six coaching dimensions from 1 to 5 using the rubric ([evaluation-rubric.md](evaluation-rubric.md)) without seeing the AI scores or the report.
3. **Compare.** Firefly computes the differences, the share of scores within one point, and any consistent over- or under-scoring, overall and per dimension.
4. **Discuss the large gaps.** Where a mentor and the evaluator differ by two points or more, read the transcript together. Either the rubric needs clearer wording, the evaluator needs a fix, or the mentors need to align with each other.
5. **Track versions.** When you change the evaluator or the rubric, change its version and calibrate again. Results from different versions are listed side by side, never silently mixed.

### In the app

The Calibration page lists completed sessions that have not been reviewed. Choosing one opens a review form that shows the transcript and the rubric but not the AI scores. Saving the review records it, and the page then shows the metrics computed from every stored review. The page can also include the bundled sample records, which are always labelled as samples.

### From files

You can also compare scores kept in a file, for example from a spreadsheet exported by a review session:

```
npm run calibrate                          # reads calibration/samples/*.json
npm run calibrate -- path/to/records.json  # one or more files or folders
npm run calibrate -- --json records.json   # machine-readable output
```

The command exits with an error and a plain explanation if a file does not match the format below.

## File format

```json
{
  "note": "Optional text for people reading the file.",
  "records": [
    {
      "sessionId": "call-2025-001",
      "evaluatorVersion": "rules-1.0.0",
      "rubricVersion": "rubric-1",
      "source": "mentor",
      "reviewer": "Initials only",
      "ai": {
        "opening-rapport": 4,
        "scoping-discovery": 3,
        "empathy-deescalation": 4,
        "clarity": 4,
        "ownership-next-steps": 4,
        "closing": 3
      },
      "mentor": {
        "opening-rapport": 4,
        "scoping-discovery": 2,
        "empathy-deescalation": 4,
        "clarity": 3,
        "ownership-next-steps": 4,
        "closing": 3
      }
    }
  ]
}
```

| Field              | Meaning                                                                                           |
| ------------------ | ------------------------------------------------------------------------------------------------- |
| `sessionId`        | Any identifier for the practice call (1 to 64 characters).                                        |
| `evaluatorVersion` | The evaluator that produced the AI scores, for example `rules-1.0.0`.                             |
| `rubricVersion`    | The rubric the mentor used, for example `rubric-1`.                                               |
| `source`           | `mentor` for a real review (the default) or `sample` for an invented example.                     |
| `reviewer`         | Optional. Use initials. Do not enter real customer information anywhere in these files.           |
| `ai` and `mentor`  | All six dimensions, each a whole number from 1 to 5. A missing or out-of-range score is rejected. |

The dimension ids are `opening-rapport`, `scoping-discovery`, `empathy-deescalation`, `clarity`, `ownership-next-steps` and `closing`.

`calibration/samples/synthetic-example.json` is a short file of invented records that shows the format. They are not mentor reviews and tell you nothing about how well the evaluator agrees with people.

## What the numbers mean

| Measure                      | How it is computed                                                      | How to read it                                                                                |
| ---------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| **Mean absolute difference** | The average of \|AI score minus mentor score\| over all compared scores | 0 means identical scores. 1 means they differ by one point on average.                        |
| **Within 1 point**           | The share of compared scores where the two differ by at most one        | A high share is reassuring only if the sample is large and varied.                            |
| **Bias**                     | The average of (AI score minus mentor score)                            | Positive means the AI scores higher than mentors. Differences under 0.25 are not called bias. |
| **Per dimension**            | The same three measures for each of the six dimensions                  | Shows where to look first, for example a dimension where the AI is consistently generous.     |

## Limits

- **Small samples.** Fewer than 5 reviewed sessions is anecdotal and fewer than 20 is indicative only. Firefly shows this next to the figures.
- **Mentors differ.** Two mentors can score the same call differently. Agreement with one mentor is not agreement with the profession.
- **Synthetic sessions.** Calibration uses fictional practice calls, so it says nothing about real customer interactions.
- **The rules evaluator is pattern-based.** It reads what trainees wrote, not tone of voice, and a model-written evaluator behaves differently. Calibrate whichever evaluator you actually use.
- **Calibration is not certification.** Nothing here makes the scores suitable for assessing people. They are practice feedback.
