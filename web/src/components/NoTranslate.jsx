/**
 * NoTranslate — NovaSound TITAN LUX v3
 *
 * Technique CSS content:attr(data-ns) :
 *  • L'élément rendu est VIDE côté DOM (aucun nœud texte)
 *  • CSS affiche le texte via ::before { content: attr(data-ns) }
 *  • Elfsight, Google Translate, DeepL ne traduisent que les
 *    nœuds texte du DOM — jamais le CSS généré
 *  → Protection absolue, sans JS runtime
 */
import React from 'react';

const NoTranslate = ({
  children,
  tag = 'span',
  className = '',
  style = {},
  onClick,
  title,
  block = false, // true si l'élément doit être block (p, h1, div...)
}) => {
  const text =
    typeof children === 'string' ? children
    : typeof children === 'number' ? String(children)
    : (children == null ? '' : String(children));

  const Tag = tag;
  // block=true ou tag bloc → classe ns-notrans-block pour ::before display:block
  const isBlock = block || ['p','h1','h2','h3','h4','h5','h6','div'].includes(tag);

  return (
    <Tag
      className={`${isBlock ? 'ns-notrans-block' : 'ns-notrans'} ${className}`}
      style={style}
      onClick={onClick}
      title={title}
      data-ns={text}
      translate="no"
      aria-label={text}
    />
  );
};

export default NoTranslate;
