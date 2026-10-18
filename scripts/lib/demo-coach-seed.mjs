/** @param {string} seed */
export function fitnessDemoCoachSeedSql(seed) {
  const start = "-- BEGIN DEV0336 FITNESS COACH";
  const end = "-- END DEV0336 FITNESS COACH";
  if (
    seed.split(start).length !== 2 ||
    seed.split(end).length !== 2 ||
    seed.indexOf(start) >= seed.indexOf(end)
  )
    throw new Error(
      "The exact additive Fitness demo seed block is unavailable.",
    );
  return seed.slice(seed.indexOf(start) + start.length, seed.indexOf(end));
}
