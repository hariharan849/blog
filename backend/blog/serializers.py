from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from .models import BlogPost, Category, Comment
from .services import absolute_url


def author_name(user):
    return user.get_full_name() or user.username


class PostSerializer(serializers.ModelSerializer):
    """Read representation of a post (list + detail)."""

    url = serializers.SerializerMethodField()
    author = serializers.SerializerMethodField()
    category = serializers.SerializerMethodField()
    category_slug = serializers.SerializerMethodField()
    tags = serializers.SerializerMethodField()
    image = serializers.SerializerMethodField()
    published_at = serializers.SerializerMethodField()
    reading_minutes = serializers.SerializerMethodField()

    class Meta:
        model = BlogPost
        fields = [
            "title", "slug", "url", "blog", "author", "category", "category_slug", "tags", "summary",
            "image", "published_at", "updated_at", "reading_minutes",
        ]

    def get_url(self, post):
        return absolute_url(self.context["request"], post.get_absolute_url())

    def get_author(self, post):
        return author_name(post.author)

    def get_category(self, post):
        return post.category.name if post.category else None

    def get_category_slug(self, post):
        return post.category.slug if post.category else None

    def get_tags(self, post):
        return sorted(post.tags.names())

    def get_image(self, post):
        return post.image.url if post.image else None  # relative /media/... path, proxied by the frontend

    def get_published_at(self, post):
        return (post.published_at or post.created_at).isoformat()

    def get_reading_minutes(self, post):
        return max(1, round(len(post.search_text.split()) / 230))  # ~230 words per minute


class PostDetailSerializer(PostSerializer):
    content_html = serializers.CharField(source="content")
    content_text = serializers.CharField(source="search_text")
    tag_slugs = serializers.SerializerMethodField()

    class Meta(PostSerializer.Meta):
        fields = PostSerializer.Meta.fields + ["content_html", "content_text", "tag_slugs"]

    def get_tag_slugs(self, post):
        return [{"name": tag.name, "slug": tag.slug} for tag in post.tags.order_by("name")]


class PostWriteSerializer(serializers.ModelSerializer):
    """Create a post (superusers). Tags as a comma-separated string; optional new category."""

    category = serializers.SlugRelatedField(
        slug_field="slug", queryset=Category.objects.all(), required=False, allow_null=True
    )
    new_category = serializers.CharField(required=False, allow_blank=True, write_only=True, max_length=100)
    tags = serializers.CharField(required=False, allow_blank=True, write_only=True)

    class Meta:
        model = BlogPost
        fields = ["title", "blog", "excerpt", "content", "image", "category", "new_category", "tags", "is_published"]

    def validate_content(self, value):
        if not value.strip():
            raise serializers.ValidationError("Content is required.")
        return value

    def create(self, validated_data):
        new_category = validated_data.pop("new_category", "").strip()
        tags = [tag.strip() for tag in validated_data.pop("tags", "").split(",") if tag.strip()]
        if new_category:
            validated_data["category"], _ = Category.objects.get_or_create(name=new_category)
        post = BlogPost.objects.create(author=self.context["request"].user, **validated_data)
        if tags:
            post.tags.set(tags)
        return post


class CategorySerializer(serializers.ModelSerializer):
    post_count = serializers.IntegerField(read_only=True, required=False)

    class Meta:
        model = Category
        fields = ["name", "slug", "post_count"]


class CommentSerializer(serializers.ModelSerializer):
    name = serializers.CharField(required=False, max_length=100)
    email = serializers.EmailField(required=False, write_only=True)

    class Meta:
        model = Comment
        fields = ["id", "name", "email", "content", "created_at"]
        read_only_fields = ["id", "created_at"]

    def validate_content(self, value):
        if not value.strip():
            raise serializers.ValidationError("Comment cannot be empty.")
        return value.strip()


class UserSerializer(serializers.ModelSerializer):
    name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["username", "email", "name", "is_staff", "is_superuser"]

    def get_name(self, user):
        return author_name(user)


class RegisterSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    password1 = serializers.CharField(write_only=True)
    password2 = serializers.CharField(write_only=True)

    def validate_username(self, value):
        value = value.strip()
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError("Username already exists.")
        return value

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("Email already registered.")
        return value

    def validate(self, data):
        if data["password1"] != data["password2"]:
            raise serializers.ValidationError({"password2": ["Passwords do not match."]})
        try:
            validate_password(data["password1"], User(username=data["username"], email=data["email"]))
        except Exception as error:  # django ValidationError
            raise serializers.ValidationError({"password1": list(getattr(error, "messages", [str(error)]))})
        return data

    def create(self, validated_data):
        return User.objects.create_user(
            username=validated_data["username"], email=validated_data["email"],
            password=validated_data["password1"],
        )
