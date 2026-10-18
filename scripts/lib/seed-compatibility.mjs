// Rehearsals capped at the former six-discipline schema cannot seed Fitness.
// Normal local/dev setup must use the complete current seed instead.
export function seedBeforeFitness(seed) {
  const start = "-- BEGIN DEV0336 FITNESS COACH";
  const end = "-- END DEV0336 FITNESS COACH";
  if (
    seed.split(start).length !== 2 ||
    seed.split(end).length !== 2 ||
    seed.indexOf(start) >= seed.indexOf(end)
  )
    throw new Error(
      "Historical rehearsal requires one exact Fitness fixture block.",
    );
  return (
    seed.slice(0, seed.indexOf(start)) +
    seed.slice(seed.indexOf(end) + end.length)
  );
}
