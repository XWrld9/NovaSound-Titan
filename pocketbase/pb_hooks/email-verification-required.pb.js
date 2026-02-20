/// <reference path="../pb_data/types.d.ts" />
onRecordAuthRequest((e) => {
  if (!e.record.get("verified")) {
    throw new BadRequestError("Please verify your email before logging in");
  }
  e.next();
}, "users");