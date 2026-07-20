import React from 'react';
import { Composition, Still } from 'remotion';
import { Teaser, DURATION } from './Teaser.jsx';
import { STILLS } from './Stills.jsx';

export const RemotionRoot = () => (
  <>
    <Composition
      id="teaser"
      component={Teaser}
      durationInFrames={DURATION}
      fps={30}
      width={1920}
      height={1080}
    />
    {/* social cards: the OG image + one still per launch-thread post */}
    {STILLS.map((s) => (
      <Still key={s.id} id={s.id} component={s.component} width={s.width} height={s.height} />
    ))}
  </>
);
