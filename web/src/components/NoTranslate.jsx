/**
 * NoTranslate — NovaSound TITAN LUX v5 — IMMUNISÉ
 *
 * Technique CSS custom property var(--nt) :
 *  • Les variables CSS inline (style="--nt:...") ne sont JAMAIS
 *    touchées par aucun traducteur (Elfsight, Google, DeepL...)
 *  • L'élément est vide côté DOM → rien à traduire
 *  • CSS affiche le texte via ::before { content: var(--nt) }
 *
 * Règle : toujours utiliser <NoTranslate tag="p"> plutôt que
 * <p><NoTranslate></p> pour que translate="no" soit sur le bon élément
 */
import React from 'react';

function toText(v) {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return '';
  if (Array.isArray(v)) return v.map(toText).join('');
  if (v && typeof v === 'object' && v.props?.children != null)
    return toText(v.props.children);
  return '';
}

// Encode pour CSS custom property : les guillemets doublent
function toCssProp(text) {
  // La valeur doit être une string CSS valide pour content: var(--nt)
  // On passe par un attribut data et on lit via attr() en fallback
  return text;
}

const NoTranslate = ({
  children,
  tag = 'span',
  className = '',
  style = {},
  onClick,
  title,
}) => {
  const text = toText(children);
  const Tag = tag;
  const isBlock = ['p','h1','h2','h3','h4','h5','h6','div','li'].includes(tag);

  return (
    <Tag
      className={`${isBlock ? 'ns-notrans-block' : 'ns-notrans'} ${className}`}
      style={{ ...style, '--nt': JSON.stringify(text) }}
      onClick={onClick}
      title={title || text}
      data-ns={text}
      translate="no"
      aria-label={text}
    />
  );
};

export default NoTranslate;
