Reusable "normal" investigation images. Each shows an unremarkable/reference finding, so any case whose patient
would genuinely have a normal result for that test can reuse the same file — the whole point being that a normal
scan looks the same regardless of the patient's unrelated diagnosis (see `lib/simulation/case-resolvers.ts`,
`NORMAL_IMAGE`, and each case's own `investigation_results[testId].image_url` override).

Sourced from Wikimedia Commons and PubMed Central, and verified individually (opened and visually checked, not
taken on the filename or caption alone) for (a) actually showing what the title claims — real, unlabelled, reads
as an actual patient result, not a teaching diagram — and (b) being licensed for commercial use. Medikarya is a
paid product, so a non-commercial license (most of Radiopaedia, some of NLM Open-i, most single-institution
radiology journals) does not apply.

| File | Source | Author | License | Attribution required |
|---|---|---|---|---|
| cxr-pa-normal.jpg | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Normal_posteroanterior_(PA)_chest_radiograph_(X-ray).jpg) | Mikael Häggström, M.D. | CC0 1.0 (public domain) | No |
| ct-abdomen-pelvis-normal.png | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:CT_of_a_normal_abdomen_and_pelvis,_axial_plane_94.png) | Mikael Häggström, M.D. | CC0 1.0 (public domain) | No |
| ct-brain-normal.png | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:CT_of_a_normal_brain,_axial_27.png) | Mikael Häggström, M.D. | CC0 1.0 (public domain) | No |
| usg-abdomen-liver-normal.jpg | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Ultrasonography_of_a_normal_liver.jpg) | Mikael Häggström, M.D. | CC0 1.0 (public domain) | No |
| mri-brain-normal.jpg | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Normal_axial_T2-weighted_MR_image_of_the_brain.jpg) | Novaksean | CC BY-SA 4.0 | **Yes** — credit "Novaksean, CC BY-SA 4.0, via Wikimedia Commons" wherever this image is publicly shown |
| echo-4chamber-normal.jpg | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Echocardiogram_4chambers.jpg) | Uploader-granted public domain | Public domain | No |
| xray-abdomen-normal.jpg | Figure 1, [PMC13148455](https://pmc.ncbi.nlm.nih.gov/articles/PMC13148455/) (Cureus, 2026) | Alotaibi, Alghamdi, Wazzan, Alzahrani, Banjar | CC BY 4.0 | **Yes** — credit "Alotaibi AA, Alghamdi MA, Wazzan QR, Alzahrani AA, Banjar AT. *Perforated Appendicitis in a 52-Year-Old Male With Previously Undiagnosed Intestinal Malrotation.* Cureus 2026. doi:10.7759/cureus.106530. CC BY 4.0." wherever shown |

Not sourced: a normal CT pulmonary angiogram, a normal cerebral MR angiogram. Several near-misses worth recording
so they aren't re-tried the same way: a CTPA candidate (`Computed_tomograph_of_pulmonary_vessels.jpg`, Häggström,
CC0) turned out to be a labelled anatomy-teaching diagram (big text callouts — "Lobar artery", "Interlobular
vein" — overlaid on the scan); an earlier echo candidate was a hand-drawn probe-placement illustration, not a
real ultrasound; a cerebral MRA candidate with the right license (PMC10860579, BJR Open, CC BY 4.0) turned out
to have vessel-name labels burned into the image (RT ACA, LT MCA, ACoA, etc.) — real and correctly licensed, but
reads as a labelled textbook figure, not a patient's actual scan; a second MRA candidate (PMC4683875) had the
right content but the wrong license (CC BY-**NC**-SA). All four were caught by opening the file and reading it
properly, not by trusting the title or the licence line alone — both checks have to pass independently.

Structural reason these two are harder than the rest: journal case-report figures are disproportionately
labelled or built around showing pathology (that's usually why they were worth publishing), which cuts against
needing a clean, unlabelled, unremarkable image — Wikimedia's Häggström collection worked well for the others
precisely because it was built as neutral reference material, not case-report illustration.

Other sources evaluated for these two gaps and ruled out: MedPix (NLM's own teaching-file database is no longer
available — migrated to ASNR, not the "70,000+ public-domain images" it's often cited as); NIH ChestX-ray14
(license terms conflict across secondary sources, and moot anyway — CXR is already covered); CDC PHIL and NCI
Visuals Online (real, commercially-usable, public-domain sources, but leaning pathology/clinical-photo and
oncology respectively, not cross-sectional radiology). PhysioNet's PTB-XL (real ECG waveform data, genuinely
CC BY 4.0) doesn't apply at all — this app synthesizes ECGs live rather than showing a static image, by design.
