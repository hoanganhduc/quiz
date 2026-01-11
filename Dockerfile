FROM archlinux:latest

# Metadata for the image
LABEL org.opencontainers.image.title="Quiz Build TeXLive"
LABEL org.opencontainers.image.source="https://github.com/hoanganhduc/quiz"
LABEL org.opencontainers.image.description="TeXLive build image for quiz bank generation"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.authors="Duc A. Hoang <anhduc.hoang1990@gmail.com>"

# Set locale to en_US.UTF-8
RUN echo "LC_ALL=en_US.UTF-8" >> /etc/environment \
	&& echo "en_US.UTF-8 UTF-8" >> /etc/locale.gen \
	&& echo "LANG=en_US.UTF-8" > /etc/locale.conf \
	&& locale-gen en_US.UTF-8

# Initialize pacman keyring and upgrade the system
RUN pacman-key --init && \
	pacman-key --populate archlinux && \
	pacman -Sy --needed --noconfirm --disable-download-timeout archlinux-keyring && \
	pacman -Syy && \
	pacman -Su --noconfirm --disable-download-timeout

# Install necessary packages
RUN	pacman -S --noconfirm --needed base-devel zsh zsh-completions openssh git curl \
	wget sudo make fontconfig tree jre11-openjdk moreutils rsync unzip libxcrypt-compat \
	perl-file-homedir perl-yaml-tiny poppler ghostscript mupdf-tools imagemagick && \
	yes | pacman -Scc

## Copy TeXLive profile and install TeXLive
#COPY texlive*.profile /
#RUN wget https://mirror.ctan.org/systems/texlive/tlnet/install-tl-unx.tar.gz && \
	#tar xvf install-tl-unx.tar.gz && \
	#rm -rf install-tl-unx.tar.gz && \
	#cd $(basename install-tl-*) && \
	#./install-tl --profile=/texlive.profile && \
	#rm -rf /texlive.profile /install-tl-* && \
	#echo "PATH=/usr/local/texlive/2024/bin/x86_64-linux:$PATH; export PATH" >> /etc/bash.bashrc && \
	#echo "MANPATH=/usr/local/texlive/2024/texmf-dist/doc/man:$MANPATH; export MANPATH"  >> /etc/bash.bashrc && \
	#echo "INFOPATH=/usr/local/texlive/2024/texmf-dist/doc/info:$INFOPATH; export INFOPATH"  >> /etc/bash.bashrc && \
	#tlmgr update --self

# Install TeXLive from Arch repository
RUN pacman -S --noconfirm --needed texlive texlive-lang texlive-doc biber && \
	yes | pacman -Scc
	
# # Copy pax binary to /usr/bin/
# COPY pax /usr/bin/

# # Copy custom zsh configuration
# COPY .zshrc /root/

# # Download and install PDFBox
# RUN wget https://cyfuture.dl.sourceforge.net/project/pdfbox/PDFBox/PDFBox-0.7.3/PDFBox-0.7.3.zip \
# 	&& unzip PDFBox-0.7.3.zip -d /usr/share/java \
# 	&& rm -rf PDFBox-0.7.3.zip

# # Define build arguments for user creation
# ARG USERNAME=vscode
# ARG USERHOME=/home/$USERNAME
# ARG USERID=1000

# # Create a new user with specified arguments
# RUN useradd \
# 	--create-home \
# 	--home-dir "$USERHOME" \
# 	--password "" \
# 	--uid "$USERID" \
# 	--shell /bin/zsh \
# 	"$USERNAME" && \
# 	echo "$USERNAME ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers

# # Switch to the new user and set the working directory
# USER $USERNAME
# WORKDIR $USERNAME

# # Clone and install yay (AUR helper)
# RUN git clone https://aur.archlinux.org/yay.git && \
# 	cd yay && \
# 	makepkg --noconfirm --needed -sri && \
# 	cd .. && \
# 	rm -rf yay

# # Install additional packages using yay
# RUN yay -S --noconfirm --needed oh-my-zsh-git \
# 	bullet-train-oh-my-zsh-theme-git \
# 	bibtex-tidy && \
# 	yes | yay -Scc

# # Copy custom zsh configuration
# COPY .zshrc /home/$USERNAME/

# # Set the default command to zsh
# CMD [ "/bin/zsh" ]
CMD [ "/bin/bash" ]
