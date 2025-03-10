"""
Django settings for personal_blog project.

Generated by 'django-admin startproject' using Django 5.1.6.

For more information on this file, see
https://docs.djangoproject.com/en/5.1/topics/settings/

For the full list of settings and their values, see
https://docs.djangoproject.com/en/5.1/ref/settings/
"""
import os
from pathlib import Path

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent


# Quick-start development settings - unsuitable for production
# See https://docs.djangoproject.com/en/5.1/howto/deployment/checklist/

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = "django-insecure-7ei@=w^-!==ay&cd$g-h0h&$fnus%#@mamzt4h-elh75r7snj6"

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = False

ALLOWED_HOSTS = os.environ.get("DJANGO_ALLOWED_HOST", "").split(",")

# Enforce HTTPS only in production
if DEBUG:
    SECURE_SSL_REDIRECT = False
else:
    SECURE_SSL_REDIRECT = True  # Redirect HTTP to HTTPS
    SECURE_HSTS_SECONDS = 31536000  # 1 year
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True

    # Secure Cookies
    CSRF_COOKIE_SECURE = True

    # Other Security Settings
    X_FRAME_OPTIONS = "DENY"
    SECURE_BROWSER_XSS_FILTER = True
    SECURE_CONTENT_TYPE_NOSNIFF = True

# Application definition

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    'allauth',
    'allauth.account',
    'allauth.socialaccount',
    'allauth.socialaccount.providers.google',  # Google
    'allauth.socialaccount.providers.github',  # GitHub
    'allauth.socialaccount.providers.linkedin_oauth2',  # LinkedIn
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    'ckeditor',
    'ckeditor_uploader',  # If you use file uploads
    "blog",
    'taggit',
]

CKEDITOR_CONFIGS = {
    'default': {
        'toolbar': 'full',
        'height': 300,
        'width': '100%',
    }
}

CKEDITOR_UPLOAD_PATH = "uploads/"

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    'whitenoise.middleware.WhiteNoiseMiddleware',
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    'allauth.account.middleware.AccountMiddleware',
]

ROOT_URLCONF = "personal_blog.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [os.path.join(BASE_DIR, 'templates')],  # Add this line
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "personal_blog.wsgi.application"

# Site ID required by allauth
SITE_ID = 1

AUTHENTICATION_BACKENDS = (
    'django.contrib.auth.backends.ModelBackend',
    'allauth.account.auth_backends.AuthenticationBackend',
)

# Redirect URLs
LOGIN_REDIRECT_URL = '/'
ACCOUNT_LOGOUT_REDIRECT_URL = '/'

# Email Verification
ACCOUNT_EMAIL_VERIFICATION = "none"
ACCOUNT_EMAIL_REQUIRED = True

# Database
# https://docs.djangoproject.com/en/5.1/ref/settings/#databases

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",
    }
}


# Password validation
# https://docs.djangoproject.com/en/5.1/ref/settings/#auth-password-validators

AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.CommonPasswordValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.NumericPasswordValidator",
    },
]


# Internationalization
# https://docs.djangoproject.com/en/5.1/topics/i18n/

LANGUAGE_CODE = "en-us"

TIME_ZONE = "UTC"

USE_I18N = True

USE_TZ = True


# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/5.1/howto/static-files/

STATIC_URL = "static/"
# Add this line to define the folder where static files will be collected
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')

# Ensure STATICFILES_DIRS exists for additional static files
STATICFILES_DIRS = [
    os.path.join(BASE_DIR, 'static'),  # Your custom static files
]

MEDIA_URL = '/media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')

# Default primary key field type
# https://docs.djangoproject.com/en/5.1/ref/settings/#default-auto-field

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# # # ✅ Disable Debug in Production
# # DEBUG = os.getenv("DEBUG", "False") == "True"

# # # ✅ Set Allowed Hosts
# # ALLOWED_HOSTS = os.getenv("ALLOWED_HOSTS", "").split(",")

# # # ✅ Secure Secret Key
# # SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", get_random_secret_key())

# # # ✅ Enforce HTTPS
# # SECURE_SSL_REDIRECT = True  # Redirect HTTP to HTTPS
# # SECURE_HSTS_SECONDS = 31536000  # 1 year
# # SECURE_HSTS_INCLUDE_SUBDOMAINS = True
# # SECURE_HSTS_PRELOAD = True

# # # ✅ Secure Cookies
# # SESSION_COOKIE_SECURE = True
# # CSRF_COOKIE_SECURE = True

# # # ✅ Other Security Settings
# # X_FRAME_OPTIONS = "DENY"
# # SECURE_BROWSER_XSS_FILTER = True
# # SECURE_CONTENT_TYPE_NOSNIFF = True

# # STATICFILES_STORAGE = 'whitenoise.storage.CompressedStaticFilesStorage'