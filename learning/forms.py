from django import forms

from .models import Interest


class SourceImportForm(forms.Form):
    urls = forms.CharField(
        required=False,
        widget=forms.Textarea(attrs={"rows": 5, "class": "form-control",
                                     "placeholder": "https://name.substack.com\nhttps://medium.com/@writer\nhttps://pub.towardsai.net"}),
        help_text="One profile, publication, tag or feed URL per line.",
    )
    opml = forms.FileField(required=False, help_text="Or upload an OPML export from a feed reader.")

    def clean(self):
        cleaned = super().clean()
        if not cleaned.get("urls") and not cleaned.get("opml"):
            raise forms.ValidationError("Paste at least one URL or upload an OPML file.")
        return cleaned


class InterestForm(forms.ModelForm):
    class Meta:
        model = Interest
        fields = ["name", "weight"]
        widgets = {
            "name": forms.TextInput(attrs={"class": "form-control", "placeholder": "e.g. LLM agents"}),
            "weight": forms.NumberInput(attrs={"class": "form-control", "min": 1, "max": 5}),
        }
