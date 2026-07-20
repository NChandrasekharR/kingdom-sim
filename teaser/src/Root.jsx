import React from 'react';
import { Composition } from 'remotion';
import { Teaser, DURATION } from './Teaser.jsx';

export const RemotionRoot = () => (
  <Composition
    id="teaser"
    component={Teaser}
    durationInFrames={DURATION}
    fps={30}
    width={1920}
    height={1080}
  />
);
