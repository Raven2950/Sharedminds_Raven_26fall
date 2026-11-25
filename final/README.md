# Whose Voice? (final project, first slice)

Live: https://raven2950.github.io/Sharedminds_Raven_26fall/final/

A short browser game built on Ryūnosuke Akutagawa's *In a Grove* (藪の中, 1922), the story behind Kurosawa's *Rashomon*. A samurai lies dead in a bamboo grove, and three people each say a different person killed him. The story never says who is right.

- Glowing words in the grove are doors into each person's scene.
- Each scene shows one subtitle at a time. Gold words can be picked up as paper slips.
- You fill the magistrate's sentence with your slips: who killed him, with what, and why. There is no right answer.
- The game reads how you built your sentence and gives you an MBTI-style type, a bar of whose words your truth is made of, and a place on a map of other readers.

This slice is a test of the word-piecing mechanic in my thesis game, *What She Left Out*.

## Notes

- Text: lines excerpted and translated from the public-domain Japanese original.
- Pictures: generated with FLUX schnell through the ITP Replicate proxy, saved as files in `img/`.
- The grey dots on the map are sample answers written for this prototype, not real players. The next version stores real answers in Firebase and places them with sentence embeddings (transformers.js).
