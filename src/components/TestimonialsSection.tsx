import React from 'react';
import { Star, CheckCircle2, ThumbsUp } from 'lucide-react';
import { useStore } from '../context/StoreContext';

const REVIEWS = [
  {
    name: 'Gladys Benítez',
    city: 'Luque, Central',
    comment: '¡Hermoso proyector! En 2 minutos clavé la estaca en el pasto y toda la fachada de la casa quedó iluminada con figuras de Papá Noel y renos en movimiento. Le pagué al delivery recién cuando llegó. 100% recomendado.',
    rating: 5,
    pack: 'Compró Pack Familia (2 unidades)',
    photo: '/src/assets/images/noelux_fachada_jardin_1793968638764.jpg'
  },
  {
    name: 'Carlos Mendoza',
    city: 'Asunción, Barrio Jara',
    comment: 'La mejor compra navideña que hice en años. Antes pasaba horas en la escalera enredando cables que después no prendían. Con Noelux lo apoyo en el piso del porche, enchufo y listo. Los vecinos se paran a mirar.',
    rating: 5,
    pack: 'Compró 1 unidad',
    photo: '/src/assets/images/noelux_porche_balcon_base_1793968643055.jpg'
  },
  {
    name: 'María Elena Duarte',
    city: 'San Lorenzo',
    comment: 'Llegó en 24 horas exactas a mi casa en San Lorenzo. El repartidor fue muy amable, abrí la caja para mirar y le pagué por QR en el momento. Los 12 dibujos se ven muy nítidos tanto afuera como en la pared del living.',
    rating: 5,
    pack: 'Compró Pack Familia (2 unidades)',
    photo: '/src/assets/images/noelux_living_interior_pared_1793968646701.jpg'
  },
  {
    name: 'Roberto Benítez',
    city: 'Ciudad del Este, Alto Paraná',
    comment: 'Pedí 3 unidades para mi casa y para regalar a mis padres. La lluvia fuerte del fin de semana no le hizo nada, siguió proyectando en el jardín sin problemas. Es verdaderamente impermeable.',
    rating: 5,
    pack: 'Compró Pack Barrio (3 unidades)',
    photo: '/src/assets/images/noelux_lluvia_ip65_jardin_1793968651758.jpg'
  }
];

export const TestimonialsSection: React.FC = () => {
  const { currentProductPage } = useStore();
  const customLanding = currentProductPage?.landingContent;
  const customTheme = currentProductPage?.themeConfig;
  const reviewsToRender = customLanding?.reviews?.length ? customLanding.reviews : REVIEWS;
  const primaryBg = customTheme?.primaryBg || 'bg-[#0b3d2e]';
  const badgeClasses = customTheme?.badgeBg || 'bg-[#e5f6ec] border-[#86efac] text-[#064e3b]';

  return (
    <section id="testimonios" className="py-8 sm:py-12 app-container">
      <div className="text-center max-w-2xl mx-auto mb-6 sm:mb-10">
        <span className={`${badgeClasses} border text-xs sm:text-sm font-black px-4 py-1.5 rounded-full uppercase tracking-wider inline-flex items-center gap-1.5`}>
          <ThumbsUp className="w-4 h-4 text-[#1ea856]" /> {customLanding?.reviewsBadge || 'Clientes Verificados en Paraguay'}
        </span>
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-[#062319] tracking-tight mt-3 leading-tight">
          {customLanding?.reviewsTitle || '+1.420 hogares iluminados en todo el país'}
        </h2>
        <div className="flex items-center justify-center gap-2 mt-3 text-amber-500 flex-wrap">
          <div className="flex gap-0.5">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="w-5 h-5 sm:w-6 sm:h-6 fill-amber-400 text-amber-400" />
            ))}
          </div>
          <span className="text-stone-900 font-black text-base sm:text-lg">
            {customLanding?.reviewsRatingLabel || '4.9 / 5.0 calificación real'}
          </span>
        </div>
      </div>

      {/* Mobile-App Review Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-4 gap-5">
        {reviewsToRender.map((rev, idx) => (
          <div
            key={idx}
            className="bg-white border-2 border-[#dfdad0] rounded-3xl p-5 sm:p-6 shadow-md flex flex-col justify-between gap-4"
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-12 h-12 rounded-2xl ${primaryBg} text-[#ffd778] font-black text-base flex items-center justify-center shrink-0 shadow-xs`}>
                    {rev.name
                      .split(' ')
                      .map(n => n[0])
                      .join('')}
                  </div>
                  <div className="min-w-0">
                    <b className="text-base sm:text-lg font-black text-stone-900 block truncate">{rev.name}</b>
                    <span className="text-xs sm:text-sm font-bold text-stone-600 block truncate">{rev.city}</span>
                  </div>
                </div>
                <span className="bg-[#e5f6ec] text-[#0a7a4a] text-xs font-black px-2.5 py-1 rounded-xl border border-[#86efac] flex items-center gap-1 shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Verificado
                </span>
              </div>

              <div className="flex items-start gap-3.5">
                <div className="flex-1">
                  <div className="flex gap-0.5 text-amber-400 mb-2">
                    {[...Array(rev.rating || 5)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 sm:w-5 sm:h-5 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <p className="text-sm sm:text-base font-medium text-stone-800 leading-relaxed">
                    "{rev.comment}"
                  </p>
                </div>

                {/* Large 1:1 square thumbnail of the customer/product photo */}
                <div className="w-20 h-20 sm:w-22 sm:h-22 rounded-2xl overflow-hidden border-2 border-[#dfdad0] shrink-0 bg-stone-100 aspect-square shadow-xs">
                  <img
                    src={rev.photo}
                    alt={`Foto de ${rev.name}`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3.5 border-t border-stone-200 text-xs sm:text-sm font-bold text-stone-600 gap-2 flex-wrap">
              <span className="font-black text-[#0b3d2e]">{rev.pack}</span>
              <span className="bg-[#f6f4ee] px-2.5 py-1 rounded-lg text-stone-700 font-bold">Pago en puerta</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};


