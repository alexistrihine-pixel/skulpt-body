# Third-party notices

## Exercise catalogue — `assets/data/exercise-catalog.json`

Generated from the data (names, body parts, equipment, muscles, instructions) of
https://github.com/hasaneyldrm/exercises-dataset, used under the MIT License:

> MIT License — Copyright (c) 2026 Hasan Emir Yıldırım
>
> Permission is hereby granted, free of charge, to any person obtaining a copy of this software
> and associated documentation and data files (the "Software"), to deal in the Software without
> restriction, including without limitation the rights to use, copy, modify, merge, publish,
> distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the
> Software is furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all copies or
> substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED.

The dataset's images and GIFs (© Gym visual — https://gymvisual.com/) are **not** included:
they are not covered by the MIT license.

## Exercise images — `assets/exercises/*.webp` (not in git)

Exercise data by [RepDB](https://repdb.co) — free tier license: in-app use with attribution
(shown in Settings), no redistribution as a dataset, no generative-AI derivation. The WebP files
are therefore git-ignored; `tools/match_exercise_images.py --download` fetches the ones linked to
the catalogue, and `tools/build_exercise_catalog.py` regenerates `src/constants/exercise-images.ts`.
