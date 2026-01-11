FROM ghcr.io/hoanganhduc/texlive:latest

# Metadata for the image
LABEL org.opencontainers.image.title="Quiz Build TeXLive"
LABEL org.opencontainers.image.source="https://github.com/hoanganhduc/quiz"
LABEL org.opencontainers.image.description="TeXLive build image for quiz bank generation"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.authors="Duc A. Hoang <anhduc.hoang1990@gmail.com>"

RUN pacman -Syu --noconfirm && \
	pacman -S --noconfirm --needed poppler ghostscript mupdf-tools imagemagick && \
	yes | pacman -Scc
	
CMD [ "/bin/bash" ]
