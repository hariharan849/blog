from django import forms

from .models import BlogPost, Category, Comment


class PostForm(forms.ModelForm):
    new_category = forms.CharField(
        required=False,
        label="New Category",
        widget=forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Enter new category'})
    )

    class Meta:
        model = BlogPost
        fields = ['title', 'blog', 'excerpt', 'content', 'image', 'category', 'tags', 'is_published']
        widgets = {
            'content': forms.Textarea(attrs={'class': 'form-control'}),
            'excerpt': forms.Textarea(attrs={'class': 'form-control', 'rows': 3}),
        }

    def clean(self):
        cleaned_data = super().clean()
        new_category = cleaned_data.get("new_category")
        if new_category:
            category, created = Category.objects.get_or_create(name=new_category.strip())
            cleaned_data["category"] = category
        return cleaned_data


class CommentForm(forms.ModelForm):
    class Meta:
        model = Comment
        fields = ['name', 'email', 'content']
