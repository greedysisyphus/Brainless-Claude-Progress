// A check rollup shaped like a real one: a red preflight run on the head commit, then the
// full run that merged. Names are generic; the durations are real.
export const SAMPLE_ROLLUP = [
 {
  "name": "test",
  "status": "COMPLETED",
  "conclusion": "FAILURE",
  "startedAt": "2025-01-06T09:00:02Z",
  "completedAt": "2025-01-06T09:01:25Z"
 },
 {
  "name": "changes",
  "status": "COMPLETED",
  "conclusion": "SKIPPED",
  "startedAt": "2025-01-06T09:00:00Z",
  "completedAt": "2025-01-06T09:00:00Z"
 },
 {
  "name": "test",
  "status": "COMPLETED",
  "conclusion": "SUCCESS",
  "startedAt": "2025-01-06T09:09:37Z",
  "completedAt": "2025-01-06T09:26:24Z"
 },
 {
  "name": "changes",
  "status": "COMPLETED",
  "conclusion": "SUCCESS",
  "startedAt": "2025-01-06T09:09:37Z",
  "completedAt": "2025-01-06T09:09:44Z"
 },
 {
  "name": "lint",
  "status": "COMPLETED",
  "conclusion": "SKIPPED",
  "startedAt": "2025-01-06T09:00:01Z",
  "completedAt": "2025-01-06T09:00:00Z"
 },
 {
  "name": "lint",
  "status": "COMPLETED",
  "conclusion": "SKIPPED",
  "startedAt": "2025-01-06T09:09:45Z",
  "completedAt": "2025-01-06T09:09:44Z"
 },
 {
  "name": "build-image",
  "status": "COMPLETED",
  "conclusion": "SKIPPED",
  "startedAt": "2025-01-06T09:00:01Z",
  "completedAt": "2025-01-06T09:00:00Z"
 },
 {
  "name": "build-image",
  "status": "COMPLETED",
  "conclusion": "SKIPPED",
  "startedAt": "2025-01-06T09:09:45Z",
  "completedAt": "2025-01-06T09:09:44Z"
 },
 {
  "name": "deploy",
  "status": "COMPLETED",
  "conclusion": "SKIPPED",
  "startedAt": "2025-01-06T09:00:01Z",
  "completedAt": "2025-01-06T09:00:00Z"
 },
 {
  "name": "deploy",
  "status": "COMPLETED",
  "conclusion": "SKIPPED",
  "startedAt": "2025-01-06T09:09:45Z",
  "completedAt": "2025-01-06T09:09:44Z"
 },
 {
  "name": "ci-gate",
  "status": "COMPLETED",
  "conclusion": "FAILURE",
  "startedAt": "2025-01-06T09:00:03Z",
  "completedAt": "2025-01-06T09:00:08Z"
 },
 {
  "name": "ci-gate",
  "status": "COMPLETED",
  "conclusion": "SUCCESS",
  "startedAt": "2025-01-06T09:09:46Z",
  "completedAt": "2025-01-06T09:09:53Z"
 }
]
