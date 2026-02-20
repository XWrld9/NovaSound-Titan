/// <reference path="../pb_data/types.d.ts" />

onRecordAfterCreateRequest((e) => {
  // Mettre à jour les compteurs de followers/following
  const followerId = e.record.get("follower");
  const followingId = e.record.get("following");
  
  try {
    const follower = $app.dao().findRecordById("users", followerId);
    const following = $app.dao().findRecordById("users", followingId);
    
    // Mettre à jour le nombre de following pour le follower
    const followingCount = $app.dao().findRecordsByFilter(
      "follows", 
      `follower = "${followerId}"`
    ).length;
    follower.set("following", followingCount);
    $app.dao().saveRecord(follower);
    
    // Mettre à jour le nombre de followers pour le following
    const followersCount = $app.dao().findRecordsByFilter(
      "follows", 
      `following = "${followingId}"`
    ).length;
    following.set("followers", followersCount);
    $app.dao().saveRecord(following);
  } catch (error) {
    console.error('Error updating follow counts:', error);
  }
}, "follows");
