/// <reference path="../pb_data/types.d.ts" />
onRecordAfterCreateSuccess((e) => {
  const songId = e.record.get("songId");
  
  if (!songId) {
    e.next();
    return;
  }
  
  try {
    const song = $app.dao().findRecordById("songs", songId);
    if (song) {
      const currentPlays = song.get("plays_count") || 0;
      song.set("plays_count", currentPlays + 1);
      $app.dao().saveRecord(song);
    }
  } catch (err) {
    console.log("Error incrementing play count: " + err.message);
  }
  
  e.next();
}, "play_history");