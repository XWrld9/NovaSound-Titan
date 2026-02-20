/// <reference path="../pb_data/types.d.ts" />

onRecordAfterDeleteRequest((e) => {
  // Mettre à jour le compteur de likes sur la chanson
  const songId = e.record.get("song");
  
  try {
    const song = $app.dao().findRecordById("songs", songId);
    
    const likesCount = $app.dao().findRecordsByFilter(
      "likes", 
      `song = "${songId}"`
    ).length;
    
    song.set("likes", likesCount);
    $app.dao().saveRecord(song);
  } catch (error) {
    console.error('Error updating like count after delete:', error);
  }
}, "likes");
