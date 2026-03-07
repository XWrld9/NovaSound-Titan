/**
 * PlayerTimeContext — NovaSound TITAN LUX v500000
 *
 * ✅ Isole audioCurrentTime et audioDuration dans un contexte séparé
 *    → Les SongCard, BottomNav, Header etc. NE S'ABONNENT PAS à ce contexte
 *    → Seuls AudioPlayer et LocalPlayerPage (seekbar) y accèdent
 *    → Élimine le clignotement excessif lors de la lecture musicale
 */
import React, { createContext, useContext, useState } from 'react';

const PlayerTimeContext = createContext({ audioCurrentTime: 0, audioDuration: 0 });

export const usePlayerTime = () => useContext(PlayerTimeContext);

export const PlayerTimeProvider = ({ children }) => {
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioDuration,    setAudioDuration]    = useState(0);

  return (
    <PlayerTimeContext.Provider value={{ audioCurrentTime, audioDuration, setAudioCurrentTime, setAudioDuration }}>
      {children}
    </PlayerTimeContext.Provider>
  );
};
