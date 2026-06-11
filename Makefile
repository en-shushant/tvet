.PHONY: desktop-icons desktop-build desktop-install desktop-quit

desktop-icons:
	APP_NAME='TVETtrack' APP_SLUG='tvettrack' bash scripts/desktop-icons.sh

desktop-build:
	bash scripts/desktop-build.sh

desktop-install:
	bash scripts/desktop-install.sh

desktop-quit:
	bash scripts/desktop-quit.sh
