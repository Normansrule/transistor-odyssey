"""Lithography optics: the aerial image of a line/space mask (Fourier optics).

A periodic mask of pitch p diffracts light into orders at spatial frequencies
f_n = n/p. The projection lens passes only frequencies with
|f_n + f_s| ≤ NA/λ, where f_s is the tilt of the illuminating plane wave.
For one source point the image amplitude is Σ c_n P(f_n + f_s) e^{2πi f_n x};
partially coherent (Köhler) illumination adds the intensities of all source
points (Abbe's method; Hopkins 1953; Mack, Fundamental Principles of Optical
Lithography, 2007).

Source shapes (in units of NA/λ, 1D cut through a round pupil):
  conventional disk of radius σ — weight ∝ √(1 − (s/σ)²)
  dipole: two poles centred at ±σ_c with half-width σ_w
Defocus z multiplies each order by exp(iπλz f²) (paraxial).
Binary mask orders: c_0 = duty, c_n = sin(π n duty)/(π n).
Resolution limits: coherent light (σ = 0) images nothing below p = λ/NA;
the absolute limit with oblique illumination is p = λ/(2NA), i.e. k₁ = 0.25.
"""
from __future__ import annotations

import math

import numpy as np


def source_points(kind="conventional", sigma=0.5, sigma_c=0.7, sigma_w=0.1, n=41):
    """Source positions s (units of NA/λ) and weights."""
    if kind == "coherent" or (kind == "conventional" and sigma <= 1e-6):
        return np.array([0.0]), np.array([1.0])
    if kind == "conventional":
        s = np.linspace(-sigma, sigma, n)
        w = np.sqrt(np.clip(1 - (s / sigma) ** 2, 0, None))
    elif kind == "dipole":
        half = np.linspace(-sigma_w, sigma_w, n // 2)
        s = np.r_[-sigma_c + half, sigma_c + half]
        w = np.sqrt(np.clip(1 - (np.r_[half, half] / sigma_w) ** 2, 0, None))
    else:
        raise ValueError(kind)
    return s, w / w.sum()


def aerial_image(pitch_nm, lam_nm=193.0, NA=1.35, duty=0.5, kind="conventional", sigma=0.5,
                 sigma_c=0.7, sigma_w=0.1, defocus_nm=0.0, npts=256, periods=2, nmax=None):
    """Intensity across `periods` pitches (clear-field normalised to 1)."""
    x = np.linspace(0, periods * pitch_nm, npts)
    fc = NA / lam_nm
    if nmax is None:
        nmax = int(math.ceil(2 * fc * pitch_nm)) + 1
    ns = np.arange(-nmax, nmax + 1)
    fn = ns / pitch_nm
    c = np.where(ns == 0, duty, np.sin(math.pi * ns * duty) / (math.pi * np.where(ns == 0, 1, ns)))
    s, w = source_points(kind, sigma, sigma_c, sigma_w)
    I = np.zeros(npts)
    for si, wi in zip(s, w):
        fs = si * fc
        pas = np.abs(fn + fs) <= fc + 1e-12
        if not pas.any():
            continue
        phase = np.exp(1j * math.pi * lam_nm * defocus_nm * ((fn + fs) ** 2 - fs ** 2))
        amp = (c * pas * phase)[None, :] * np.exp(2j * math.pi * fn[None, :] * x[:, None])
        I += wi * np.abs(amp.sum(1)) ** 2
    return x, I


def contrast(I):
    return float((I.max() - I.min()) / (I.max() + I.min() + 1e-300))


def printed_cd(x, I, pitch_nm, threshold=0.3):
    """Width of the region above threshold within one pitch (nm): the printed space in positive resist."""
    per = x <= pitch_nm
    above = I[per] > threshold
    return float(above.mean() * pitch_nm)


def k1(pitch_nm, lam_nm, NA):
    return pitch_nm / 2 * NA / lam_nm
