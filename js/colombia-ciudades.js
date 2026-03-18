/**
 * colombia-ciudades.js
 * Lista estática de los 1.127 municipios de Colombia (DIVIPOLA - DANE)
 * + combobox de búsqueda y lógica completa del modal de registro.
 *
 * No requiere ninguna API externa.
 */

const MUNICIPIOS_COLOMBIA = [
  "Abejorral, Antioquia",
  "Abriaquí, Antioquia",
  "Acacías, Meta",
  "Acandí, Chocó",
  "Acevedo, Huila",
  "Achí, Bolívar",
  "Agrado, Huila",
  "Agua de Dios, Cundinamarca",
  "Aguachica, Cesar",
  "Aguada, Santander",
  "Aguadas, Caldas",
  "Aguazul, Casanare",
  "Agustín Codazzi, Cesar",
  "Aipe, Huila",
  "Albania, Caquetá",
  "Albania, La Guajira",
  "Albania, Santander",
  "Albán, Cundinamarca",
  "Albán, Nariño",
  "Alcalá, Valle del Cauca",
  "Aldana, Nariño",
  "Alejandría, Antioquia",
  "Algarrobo, Magdalena",
  "Algeciras, Huila",
  "Almaguer, Cauca",
  "Almeida, Boyacá",
  "Alpujarra, Tolima",
  "Altamira, Huila",
  "Alto Baudó, Chocó",
  "Altos del Rosario, Bolívar",
  "Alvarado, Tolima",
  "Amagá, Antioquia",
  "Amalfi, Antioquia",
  "Ambalema, Tolima",
  "Anapoima, Cundinamarca",
  "Ancuyá, Nariño",
  "Andalucía, Valle del Cauca",
  "Andes, Antioquia",
  "Angelópolis, Antioquia",
  "Angostura, Antioquia",
  "Anolaima, Cundinamarca",
  "Anorí, Antioquia",
  "Anserma, Caldas",
  "Ansermanuevo, Valle del Cauca",
  "Anzoátegui, Tolima",
  "Anzá, Antioquia",
  "Apartadó, Antioquia",
  "Apulo, Cundinamarca",
  "Apía, Risaralda",
  "Aquitania, Boyacá",
  "Aracataca, Magdalena",
  "Aranzazu, Caldas",
  "Aratoca, Santander",
  "Arauca, Arauca",
  "Arauquita, Arauca",
  "Arbeláez, Cundinamarca",
  "Arboleda, Nariño",
  "Arboledas, Norte de Santander",
  "Arboletes, Antioquia",
  "Arcabuco, Boyacá",
  "Arenal, Bolívar",
  "Argelia, Antioquia",
  "Argelia, Cauca",
  "Argelia, Valle del Cauca",
  "Ariguaní, Magdalena",
  "Arjona, Bolívar",
  "Armenia, Antioquia",
  "Armenia, Quindío",
  "Armero, Tolima",
  "Arroyohondo, Bolívar",
  "Astrea, Cesar",
  "Ataco, Tolima",
  "Atrato, Chocó",
  "Ayapel, Córdoba",
  "Bagadó, Chocó",
  "Bahía Solano, Chocó",
  "Bajo Baudó, Chocó",
  "Balboa, Cauca",
  "Balboa, Risaralda",
  "Baranoa, Atlántico",
  "Baraya, Huila",
  "Barbacoas, Nariño",
  "Barbosa, Antioquia",
  "Barbosa, Santander",
  "Barichara, Santander",
  "Barranca de Upía, Meta",
  "Barrancabermeja, Santander",
  "Barrancas, La Guajira",
  "Barranco de Loba, Bolívar",
  "Barranco Minas, Guainía",
  "Barranquilla, Atlántico",
  "Becerril, Cesar",
  "Belalcázar, Caldas",
  "Bello, Antioquia",
  "Belmira, Antioquia",
  "Beltrán, Cundinamarca",
  "Belén de Los Andaquíes, Caquetá",
  "Belén de Umbría, Risaralda",
  "Belén, Boyacá",
  "Belén, Nariño",
  "Berbeo, Boyacá",
  "Betania, Antioquia",
  "Betulia, Antioquia",
  "Betulia, Santander",
  "Betéitiva, Boyacá",
  "Bituima, Cundinamarca",
  "Boavita, Boyacá",
  "Bochalema, Norte de Santander",
  "Bogotá D.C., Boyacá",
  "Bogotá D.C., Cundinamarca",
  "Bojacá, Cundinamarca",
  "Bojayá, Chocó",
  "Bolívar, Cauca",
  "Bolívar, Santander",
  "Bolívar, Valle del Cauca",
  "Bosconia, Cesar",
  "Boyacá, Boyacá",
  "Briceño, Antioquia",
  "Briceño, Boyacá",
  "Bucaramanga, Santander",
  "Bucarasica, Norte de Santander",
  "Buenaventura, Valle del Cauca",
  "Buenavista, Boyacá",
  "Buenavista, Córdoba",
  "Buenavista, Quindío",
  "Buenavista, Sucre",
  "Buenos Aires, Cauca",
  "Buesaco, Nariño",
  "Buga, Valle del Cauca",
  "Bugalagrande, Valle del Cauca",
  "Buriticá, Antioquia",
  "Busbanzá, Boyacá",
  "Cabrera, Cundinamarca",
  "Cabrera, Santander",
  "Cabuyaro, Meta",
  "Cacahual, Guainía",
  "Cachipay, Cundinamarca",
  "Caicedo, Antioquia",
  "Caicedonia, Valle del Cauca",
  "Caimito, Sucre",
  "Cajamarca, Tolima",
  "Cajibío, Cauca",
  "Cajicá, Cundinamarca",
  "Calamar, Bolívar",
  "Calamar, Guaviare",
  "Calarcá, Quindío",
  "Caldas, Antioquia",
  "Caldas, Boyacá",
  "Caldono, Cauca",
  "Cali, Valle del Cauca",
  "California, Santander",
  "Calima, Valle del Cauca",
  "Caloto, Cauca",
  "Campamento, Antioquia",
  "Campo de La Cruz, Atlántico",
  "Campoalegre, Huila",
  "Campohermoso, Boyacá",
  "Canalete, Córdoba",
  "Candelaria, Atlántico",
  "Candelaria, Valle del Cauca",
  "Cantagallo, Bolívar",
  "Caparrapí, Cundinamarca",
  "Capitanejo, Santander",
  "Caracolí, Antioquia",
  "Caramanta, Antioquia",
  "Carcasí, Santander",
  "Carepa, Antioquia",
  "Carmen de Apicalá, Tolima",
  "Carmen de Carupa, Cundinamarca",
  "Carmen del Darién, Chocó",
  "Carolina, Antioquia",
  "Cartagena del Chairá, Caquetá",
  "Cartagena, Bolívar",
  "Cartago, Valle del Cauca",
  "Carurú, Vaupés",
  "Casabianca, Tolima",
  "Castilla la Nueva, Meta",
  "Caucasia, Antioquia",
  "Cañasgordas, Antioquia",
  "Cepitá, Santander",
  "Cereté, Córdoba",
  "Cerinza, Boyacá",
  "Cerrito, Santander",
  "Cerro de San Antonio, Magdalena",
  "Chachagüí, Nariño",
  "Chaguaní, Cundinamarca",
  "Chalán, Sucre",
  "Chaparral, Tolima",
  "Charalá, Santander",
  "Charta, Santander",
  "Chibolo, Magdalena",
  "Chigorodó, Antioquia",
  "Chima, Santander",
  "Chimichagua, Cesar",
  "Chimá, Córdoba",
  "Chinavita, Boyacá",
  "Chinchiná, Caldas",
  "Chinácota, Norte de Santander",
  "Chinú, Córdoba",
  "Chipaque, Cundinamarca",
  "Chipatá, Santander",
  "Chiquinquirá, Boyacá",
  "Chiriguaná, Cesar",
  "Chiscas, Boyacá",
  "Chita, Boyacá",
  "Chitagá, Norte de Santander",
  "Chitaraque, Boyacá",
  "Chivatá, Boyacá",
  "Choachí, Cundinamarca",
  "Chocontá, Cundinamarca",
  "Chámeza, Casanare",
  "Chía, Cundinamarca",
  "Chíquiza, Boyacá",
  "Cicuco, Bolívar",
  "Cimitarra, Santander",
  "Circasia, Quindío",
  "Cisneros, Antioquia",
  "Ciudad Bolívar, Antioquia",
  "Ciénaga de Oro, Córdoba",
  "Ciénaga, Magdalena",
  "Ciénega, Boyacá",
  "Clemencia, Bolívar",
  "Cocorná, Antioquia",
  "Coello, Tolima",
  "Cogua, Cundinamarca",
  "Colombia, Huila",
  "Colosó, Sucre",
  "Colón, Nariño",
  "Colón, Putumayo",
  "Concepción, Antioquia",
  "Concepción, Santander",
  "Concordia, Antioquia",
  "Concordia, Magdalena",
  "Condoto, Chocó",
  "Confines, Santander",
  "Consacá, Nariño",
  "Contadero, Nariño",
  "Contratación, Santander",
  "Convención, Norte de Santander",
  "Copacabana, Antioquia",
  "Coper, Boyacá",
  "Corinto, Cauca",
  "Coromoro, Santander",
  "Corozal, Sucre",
  "Corrales, Boyacá",
  "Cota, Cundinamarca",
  "Cotorra, Córdoba",
  "Covarachía, Boyacá",
  "Coveñas, Sucre",
  "Coyaima, Tolima",
  "Cravo Norte, Arauca",
  "Cuaspud, Nariño",
  "Cubarral, Meta",
  "Cubará, Boyacá",
  "Cucaita, Boyacá",
  "Cucunubá, Cundinamarca",
  "Cucutilla, Norte de Santander",
  "Cumaral, Meta",
  "Cumaribo, Vichada",
  "Cumbal, Nariño",
  "Cumbitara, Nariño",
  "Cunday, Tolima",
  "Curillo, Caquetá",
  "Curití, Santander",
  "Curumaní, Cesar",
  "Cuítiva, Boyacá",
  "Cáceres, Antioquia",
  "Cáchira, Norte de Santander",
  "Cácota, Norte de Santander",
  "Cáqueza, Cundinamarca",
  "Cértegui, Chocó",
  "Cómbita, Boyacá",
  "Córdoba, Bolívar",
  "Córdoba, Nariño",
  "Córdoba, Quindío",
  "Dabeiba, Antioquia",
  "Dagua, Valle del Cauca",
  "Dibulla, La Guajira",
  "Distracción, La Guajira",
  "Dolores, Tolima",
  "Donmatías, Antioquia",
  "Dosquebradas, Risaralda",
  "Duitama, Boyacá",
  "Durania, Norte de Santander",
  "Ebéjico, Antioquia",
  "El Bagre, Antioquia",
  "El Banco, Magdalena",
  "El Cairo, Valle del Cauca",
  "El Calvario, Meta",
  "El Carmen de Atrato, Chocó",
  "El Carmen de Bolívar, Bolívar",
  "El Carmen de Chucurí, Santander",
  "El Carmen de Viboral, Antioquia",
  "El Carmen, Norte de Santander",
  "El Castillo, Meta",
  "El Cerrito, Valle del Cauca",
  "El Charco, Nariño",
  "El Cocuy, Boyacá",
  "El Colegio, Cundinamarca",
  "El Copey, Cesar",
  "El Doncello, Caquetá",
  "El Dorado, Meta",
  "El Dovio, Valle del Cauca",
  "El Encanto, Amazonas",
  "El Espino, Boyacá",
  "El Guacamayo, Santander",
  "El Guamo, Bolívar",
  "El Litoral del San Juan, Chocó",
  "El Líbano, Valle del Cauca",
  "El Molino, La Guajira",
  "El Paso, Cesar",
  "El Paujíl, Caquetá",
  "El Peñol, Nariño",
  "El Peñón, Bolívar",
  "El Peñón, Cundinamarca",
  "El Peñón, Santander",
  "El Piñón, Magdalena",
  "El Playón, Santander",
  "El Retorno, Guaviare",
  "El Retén, Magdalena",
  "El Roble, Córdoba",
  "El Roble, Sucre",
  "El Rosal, Cundinamarca",
  "El Rosario, Nariño",
  "El Santuario, Antioquia",
  "El Tablón de Gómez, Nariño",
  "El Tambo, Cauca",
  "El Tambo, Nariño",
  "El Tarra, Norte de Santander",
  "El Zulia, Norte de Santander",
  "El Águila, Valle del Cauca",
  "Elías, Huila",
  "Encino, Santander",
  "Enciso, Santander",
  "Entrerríos, Antioquia",
  "Envigado, Antioquia",
  "Espinal, Tolima",
  "Facatativá, Cundinamarca",
  "Falan, Tolima",
  "Filadelfia, Caldas",
  "Filandia, Quindío",
  "Firavitoba, Boyacá",
  "Flandes, Tolima",
  "Florencia, Caquetá",
  "Florencia, Cauca",
  "Floresta, Boyacá",
  "Florida, Valle del Cauca",
  "Floridablanca, Santander",
  "Florián, Santander",
  "Fomeque, Cundinamarca",
  "Fonseca, La Guajira",
  "Fortul, Arauca",
  "Fosca, Cundinamarca",
  "Francisco Pizarro, Nariño",
  "Fredonia, Antioquia",
  "Fresno, Tolima",
  "Frontino, Antioquia",
  "Fuente de Oro, Meta",
  "Fundación, Magdalena",
  "Funes, Nariño",
  "Funza, Cundinamarca",
  "Fusagasugá, Cundinamarca",
  "Fúquene, Cundinamarca",
  "Gachalá, Cundinamarca",
  "Gachancipá, Cundinamarca",
  "Gachantivá, Boyacá",
  "Gachetá, Cundinamarca",
  "Galapa, Atlántico",
  "Galeras, Sucre",
  "Galán, Santander",
  "Gama, Cundinamarca",
  "Gamarra, Cesar",
  "Garagoa, Boyacá",
  "Garzón, Huila",
  "Gigante, Huila",
  "Ginebra, Valle del Cauca",
  "Giraldo, Antioquia",
  "Girardot, Cundinamarca",
  "Girardota, Antioquia",
  "Girón, Santander",
  "González, Cesar",
  "Gramalote, Norte de Santander",
  "Granada, Antioquia",
  "Granada, Cundinamarca",
  "Granada, Meta",
  "Guaca, Santander",
  "Guacamayas, Boyacá",
  "Guacarí, Valle del Cauca",
  "Guachené, Cauca",
  "Guachetá, Cundinamarca",
  "Guachucal, Nariño",
  "Guadalajara de Buga, Valle del Cauca",
  "Guadalupe, Antioquia",
  "Guadalupe, Huila",
  "Guadalupe, Santander",
  "Guaduas, Cundinamarca",
  "Guaitarilla, Nariño",
  "Gualmatán, Nariño",
  "Guamal, Magdalena",
  "Guamal, Meta",
  "Guamo, Tolima",
  "Guapi, Cauca",
  "Guapotá, Santander",
  "Guaranda, Sucre",
  "Guarne, Antioquia",
  "Guasca, Cundinamarca",
  "Guatapé, Antioquia",
  "Guataquí, Cundinamarca",
  "Guatavita, Cundinamarca",
  "Guateque, Boyacá",
  "Guavatá, Santander",
  "Guayabal de Síquima, Cundinamarca",
  "Guayabetal, Cundinamarca",
  "Guayatá, Boyacá",
  "Gutiérrez, Cundinamarca",
  "Guática, Risaralda",
  "Gámbita, Santander",
  "Gámeza, Boyacá",
  "Génova, Quindío",
  "Gómez Plata, Antioquia",
  "Güepsa, Santander",
  "Güicán de la Sierra, Boyacá",
  "Hacarí, Norte de Santander",
  "Hatillo de Loba, Bolívar",
  "Hato Corozal, Casanare",
  "Hato, Santander",
  "Hatonuevo, La Guajira",
  "Heliconia, Antioquia",
  "Herrán, Norte de Santander",
  "Herveo, Tolima",
  "Hispania, Antioquia",
  "Hobo, Huila",
  "Honda, Tolima",
  "Ibagué, Tolima",
  "Icononzo, Tolima",
  "Iles, Nariño",
  "Imués, Nariño",
  "Inzá, Cauca",
  "Inírida, Guainía",
  "Ipiales, Nariño",
  "Iquira, Huila",
  "Isnos, Huila",
  "Istmina, Chocó",
  "Itagüí, Antioquia",
  "Ituango, Antioquia",
  "Iza, Boyacá",
  "Jambaló, Cauca",
  "Jamundí, Valle del Cauca",
  "Jardín, Antioquia",
  "Jenesano, Boyacá",
  "Jericó, Antioquia",
  "Jericó, Boyacá",
  "Jerusalén, Cundinamarca",
  "Jesús María, Santander",
  "Jordán, Santander",
  "Juan de Acosta, Atlántico",
  "Junín, Cundinamarca",
  "Juradó, Chocó",
  "La Apartada, Córdoba",
  "La Argentina, Huila",
  "La Belleza, Santander",
  "La Calera, Cundinamarca",
  "La Capilla, Boyacá",
  "La Ceja, Antioquia",
  "La Celia, Risaralda",
  "La Chorrera, Amazonas",
  "La Cruz, Nariño",
  "La Cumbre, Valle del Cauca",
  "La Dorada, Caldas",
  "La Esperanza, Norte de Santander",
  "La Estrella, Antioquia",
  "La Florida, Nariño",
  "La Gloria, Cesar",
  "La Guadalupe, Guainía",
  "La Jagua de Ibirico, Cesar",
  "La Jagua del Pilar, La Guajira",
  "La Llanada, Nariño",
  "La Macarena, Meta",
  "La Merced, Caldas",
  "La Mesa, Cundinamarca",
  "La Montañita, Caquetá",
  "La Palma, Cundinamarca",
  "La Paz, Cesar",
  "La Paz, Santander",
  "La Pedrera, Amazonas",
  "La Peña, Cundinamarca",
  "La Pintada, Antioquia",
  "La Plata, Huila",
  "La Playa de Belén, Norte de Santander",
  "La Playa, Norte de Santander",
  "La Primavera, Vichada",
  "La Salina, Casanare",
  "La Sierra, Cauca",
  "La Tebaida, Quindío",
  "La Tola, Nariño",
  "La Unión, Antioquia",
  "La Unión, Nariño",
  "La Unión, Sucre",
  "La Unión, Valle del Cauca",
  "La Uribe, Meta",
  "La Uvita, Boyacá",
  "La Vega, Cauca",
  "La Vega, Cundinamarca",
  "La Victoria, Amazonas",
  "La Victoria, Boyacá",
  "La Victoria, Valle del Cauca",
  "La Virginia, Risaralda",
  "Labateca, Norte de Santander",
  "Labranzagrande, Boyacá",
  "Landázuri, Santander",
  "Lebrija, Santander",
  "Leguízamo, Putumayo",
  "Leiva, Nariño",
  "Lejanías, Meta",
  "Lenguazaque, Cundinamarca",
  "Leticia, Amazonas",
  "Liborina, Antioquia",
  "Linares, Nariño",
  "Lloró, Chocó",
  "Lorica, Córdoba",
  "Los Andes, Nariño",
  "Los Córdobas, Córdoba",
  "Los Palmitos, Sucre",
  "Los Patios, Norte de Santander",
  "Los Santos, Santander",
  "Lourdes, Norte de Santander",
  "Luruaco, Atlántico",
  "Lérida, Tolima",
  "Líbano, Tolima",
  "López de Micay, Cauca",
  "Macanal, Boyacá",
  "Macaravita, Santander",
  "Maceo, Antioquia",
  "Machetá, Cundinamarca",
  "Madrid, Cundinamarca",
  "Magangué, Bolívar",
  "Magüí, Nariño",
  "Mahates, Bolívar",
  "Maicao, La Guajira",
  "Majagual, Sucre",
  "Malambo, Atlántico",
  "Mallama, Nariño",
  "Manatí, Atlántico",
  "Manaure, Cesar",
  "Manaure, La Guajira",
  "Manizales, Caldas",
  "Manta, Cundinamarca",
  "Manzanares, Caldas",
  "Maní, Casanare",
  "Mapiripana, Guainía",
  "Mapiripán, Meta",
  "Margarita, Bolívar",
  "Marinilla, Antioquia",
  "Maripí, Boyacá",
  "Mariquita, Tolima",
  "Marmato, Caldas",
  "Marquetalia, Caldas",
  "Marsella, Risaralda",
  "Marulanda, Caldas",
  "María La Baja, Bolívar",
  "Matanza, Santander",
  "Medellín, Antioquia",
  "Medina, Cundinamarca",
  "Medio Atrato, Chocó",
  "Medio Baudó, Chocó",
  "Medio San Juan, Chocó",
  "Melgar, Tolima",
  "Mercaderes, Cauca",
  "Mesetas, Meta",
  "Milán, Caquetá",
  "Miraflores, Boyacá",
  "Miraflores, Guaviare",
  "Miranda, Cauca",
  "Mirití - Paraná, Amazonas",
  "Mistrató, Risaralda",
  "Mitú, Vaupés",
  "Mocoa, Putumayo",
  "Mogotes, Santander",
  "Molagavita, Santander",
  "Momil, Córdoba",
  "Mompós, Bolívar",
  "Mongua, Boyacá",
  "Monguí, Boyacá",
  "Moniquirá, Boyacá",
  "Montebello, Antioquia",
  "Montecristo, Bolívar",
  "Montelíbano, Córdoba",
  "Montenegro, Quindío",
  "Monterrey, Casanare",
  "Montería, Córdoba",
  "Morales, Bolívar",
  "Morales, Cauca",
  "Morelia, Caquetá",
  "Morichal, Guainía",
  "Morroa, Sucre",
  "Mosquera, Cundinamarca",
  "Mosquera, Nariño",
  "Motavita, Boyacá",
  "Moñitos, Córdoba",
  "Murillo, Tolima",
  "Murindó, Antioquia",
  "Mutatá, Antioquia",
  "Mutiscua, Norte de Santander",
  "Muzo, Boyacá",
  "Málaga, Santander",
  "Nariño, Antioquia",
  "Nariño, Cundinamarca",
  "Nariño, Nariño",
  "Natagaima, Tolima",
  "Nechí, Antioquia",
  "Necoclí, Antioquia",
  "Neira, Caldas",
  "Neiva, Huila",
  "Nemocón, Cundinamarca",
  "Nilo, Cundinamarca",
  "Nimaima, Cundinamarca",
  "Nobsa, Boyacá",
  "Nocaima, Cundinamarca",
  "Norcasia, Caldas",
  "Norosí, Bolívar",
  "Nueva Granada, Magdalena",
  "Nuevo Colón, Boyacá",
  "Nunchía, Casanare",
  "Nuquí, Chocó",
  "Nátaga, Huila",
  "Nóvita, Chocó",
  "Obando, Valle del Cauca",
  "Ocamonte, Santander",
  "Ocaña, Norte de Santander",
  "Oiba, Santander",
  "Oicatá, Boyacá",
  "Olaya Herrera, Nariño",
  "Olaya, Antioquia",
  "Onzaga, Santander",
  "Oporapa, Huila",
  "Orito, Putumayo",
  "Orocué, Casanare",
  "Ortega, Tolima",
  "Ospina, Nariño",
  "Otanche, Boyacá",
  "Ovejas, Sucre",
  "Pachavita, Boyacá",
  "Pacho, Cundinamarca",
  "Pacoa, Vaupés",
  "Padilla, Cauca",
  "Paicol, Huila",
  "Pailitas, Cesar",
  "Paime, Cundinamarca",
  "Paipa, Boyacá",
  "Pajarito, Boyacá",
  "Palermo, Huila",
  "Palestina, Caldas",
  "Palestina, Huila",
  "Palmar de Varela, Atlántico",
  "Palmar, Santander",
  "Palmas del Socorro, Santander",
  "Palmira, Valle del Cauca",
  "Palmito, Sucre",
  "Palocabildo, Tolima",
  "Pamplona, Norte de Santander",
  "Pamplonita, Norte de Santander",
  "Pana Pana, Guainía",
  "Pandi, Cundinamarca",
  "Panqueba, Boyacá",
  "Papunahua, Vaupés",
  "Paratebueno, Cundinamarca",
  "Pasca, Cundinamarca",
  "Pasto, Nariño",
  "Patía, Cauca",
  "Pauna, Boyacá",
  "Paya, Boyacá",
  "Payán, Nariño",
  "Paz de Ariporo, Casanare",
  "Paz de Río, Boyacá",
  "Pedraza, Magdalena",
  "Pelaya, Cesar",
  "Pensilvania, Caldas",
  "Peque, Antioquia",
  "Pereira, Risaralda",
  "Pesca, Boyacá",
  "Peñol, Antioquia",
  "Piamonte, Cauca",
  "Piedecuesta, Santander",
  "Piedras, Tolima",
  "Piendamó, Cauca",
  "Pijao, Quindío",
  "Pijiño del Carmen, Magdalena",
  "Pinchote, Santander",
  "Pinillos, Bolívar",
  "Piojó, Atlántico",
  "Pisba, Boyacá",
  "Pital, Huila",
  "Pitalito, Huila",
  "Pivijay, Magdalena",
  "Pizarro, Nariño",
  "Planadas, Tolima",
  "Planeta Rica, Córdoba",
  "Plato, Magdalena",
  "Policarpa, Nariño",
  "Polonuevo, Atlántico",
  "Ponedera, Atlántico",
  "Popayán, Cauca",
  "Pore, Casanare",
  "Potosí, Nariño",
  "Pradera, Valle del Cauca",
  "Prado, Tolima",
  "Providencia, Nariño",
  "Providencia, San Andrés y Providencia",
  "Pueblo Bello, Cesar",
  "Pueblo Nuevo, Córdoba",
  "Pueblo Rico, Risaralda",
  "Pueblorrico, Antioquia",
  "Puebloviejo, Magdalena",
  "Puente Nacional, Santander",
  "Puerres, Nariño",
  "Puerto Alegría, Amazonas",
  "Puerto Arica, Amazonas",
  "Puerto Asís, Putumayo",
  "Puerto Berrío, Antioquia",
  "Puerto Boyacá, Boyacá",
  "Puerto Caicedo, Putumayo",
  "Puerto Carreño, Vichada",
  "Puerto Colombia, Atlántico",
  "Puerto Colombia, Guainía",
  "Puerto Concordia, Meta",
  "Puerto Escondido, Córdoba",
  "Puerto Gaitán, Meta",
  "Puerto Guzmán, Putumayo",
  "Puerto Leguízamo, Putumayo",
  "Puerto Libertador, Córdoba",
  "Puerto Lleras, Meta",
  "Puerto López, Meta",
  "Puerto Nare, Antioquia",
  "Puerto Nariño, Amazonas",
  "Puerto Parra, Santander",
  "Puerto Rico, Caquetá",
  "Puerto Rico, Meta",
  "Puerto Rondón, Arauca",
  "Puerto Salgar, Cundinamarca",
  "Puerto Santander, Amazonas",
  "Puerto Santander, Norte de Santander",
  "Puerto Tejada, Cauca",
  "Puerto Triunfo, Antioquia",
  "Puerto Wilches, Santander",
  "Pulí, Cundinamarca",
  "Pupiales, Nariño",
  "Puracé, Cauca",
  "Purificación, Tolima",
  "Purísima, Córdoba",
  "Pácora, Caldas",
  "Páez, Boyacá",
  "Páez, Cauca",
  "Páramo, Santander",
  "Quebradanegra, Cundinamarca",
  "Quetame, Cundinamarca",
  "Quibdó, Chocó",
  "Quimbaya, Quindío",
  "Quinchía, Risaralda",
  "Quipile, Cundinamarca",
  "Quípama, Boyacá",
  "Ragonvalia, Norte de Santander",
  "Ramiriquí, Boyacá",
  "Recetor, Casanare",
  "Regidor, Bolívar",
  "Remedios, Antioquia",
  "Remolino, Magdalena",
  "Repelón, Atlántico",
  "Restrepo, Meta",
  "Restrepo, Valle del Cauca",
  "Retiro, Antioquia",
  "Ricaurte, Cundinamarca",
  "Ricaurte, Nariño",
  "Rioblanco, Tolima",
  "Riofrío, Valle del Cauca",
  "Riohacha, La Guajira",
  "Rionegro, Antioquia",
  "Rionegro, Santander",
  "Riosucio, Caldas",
  "Riosucio, Chocó",
  "Risaralda, Caldas",
  "Rivera, Huila",
  "Roberto Payán, Nariño",
  "Roldanillo, Valle del Cauca",
  "Roncesvalles, Tolima",
  "Rondón, Boyacá",
  "Rosas, Cauca",
  "Rovira, Tolima",
  "Ráquira, Boyacá",
  "Río de Oro, Cesar",
  "Río Iro, Chocó",
  "Río Quito, Chocó",
  "Río Viejo, Bolívar",
  "Sabana de Torres, Santander",
  "Sabanagrande, Atlántico",
  "Sabanalarga, Antioquia",
  "Sabanalarga, Atlántico",
  "Sabanalarga, Casanare",
  "Sabanas de San Ángel, Magdalena",
  "Sabaneta, Antioquia",
  "Saboyá, Boyacá",
  "Sahagún, Córdoba",
  "Saladoblanco, Huila",
  "Salamina, Caldas",
  "Salamina, Magdalena",
  "Salazar, Norte de Santander",
  "Saldaña, Tolima",
  "Salento, Quindío",
  "Salgar, Antioquia",
  "Samacá, Boyacá",
  "Samaniego, Nariño",
  "Samaná, Caldas",
  "Sampués, Sucre",
  "San Agustín, Huila",
  "San Alberto, Cesar",
  "San Andrés de Cuerquia, Antioquia",
  "San Andrés de Sotavento, Córdoba",
  "San Andrés, San Andrés y Providencia",
  "San Andrés, Santander",
  "San Antero, Córdoba",
  "San Antonio del Tequendama, Cundinamarca",
  "San Antonio, Tolima",
  "San Benito Abad, Sucre",
  "San Benito, Santander",
  "San Bernardo del Viento, Córdoba",
  "San Bernardo, Cundinamarca",
  "San Bernardo, Nariño",
  "San Calixto, Norte de Santander",
  "San Carlos de Guaroa, Meta",
  "San Carlos, Antioquia",
  "San Carlos, Córdoba",
  "San Cayetano, Cundinamarca",
  "San Cayetano, Norte de Santander",
  "San Cristóbal, Bolívar",
  "San Diego, Cesar",
  "San Eduardo, Boyacá",
  "San Estanislao, Bolívar",
  "San Felipe, Guainía",
  "San Fernando, Bolívar",
  "San Francisco, Antioquia",
  "San Francisco, Cundinamarca",
  "San Francisco, Putumayo",
  "San Gil, Santander",
  "San Jacinto del Cauca, Bolívar",
  "San Jacinto, Bolívar",
  "San Jerónimo, Antioquia",
  "San Joaquín, Santander",
  "San José de Cúcuta, Norte de Santander",
  "San José de la Montaña, Antioquia",
  "San José de Miranda, Santander",
  "San José de Pare, Boyacá",
  "San José de Uré, Córdoba",
  "San José del Fragua, Caquetá",
  "San José del Guaviare, Guaviare",
  "San José del Palmar, Chocó",
  "San José, Caldas",
  "San Juan de Arama, Meta",
  "San Juan de Betulia, Sucre",
  "San Juan de Río Seco, Cundinamarca",
  "San Juan de Urabá, Antioquia",
  "San Juan del Cesar, La Guajira",
  "San Juan Nepomuceno, Bolívar",
  "San Juanito, Meta",
  "San Lorenzo, Nariño",
  "San Luis de Gaceno, Boyacá",
  "San Luis de Palenque, Casanare",
  "San Luis, Antioquia",
  "San Luis, Tolima",
  "San Marcos, Sucre",
  "San Martín de Loba, Bolívar",
  "San Martín, Cesar",
  "San Martín, Meta",
  "San Mateo, Boyacá",
  "San Miguel de Sema, Boyacá",
  "San Miguel, Putumayo",
  "San Miguel, Santander",
  "San Onofre, Sucre",
  "San Pablo de Borbur, Boyacá",
  "San Pablo, Bolívar",
  "San Pablo, Nariño",
  "San Pedro de Cartago, Nariño",
  "San Pedro de Urabá, Antioquia",
  "San Pedro, Antioquia",
  "San Pedro, Sucre",
  "San Pedro, Valle del Cauca",
  "San Pelayo, Córdoba",
  "San Rafael, Antioquia",
  "San Roque, Antioquia",
  "San Sebastián de Buenavista, Magdalena",
  "San Sebastián, Cauca",
  "San Vicente de Chucurí, Santander",
  "San Vicente del Caguán, Caquetá",
  "San Vicente, Antioquia",
  "San Zenón, Magdalena",
  "Sandoná, Nariño",
  "Santa Ana, Magdalena",
  "Santa Bárbara de Pinto, Magdalena",
  "Santa Bárbara, Antioquia",
  "Santa Bárbara, Nariño",
  "Santa Bárbara, Santander",
  "Santa Catalina, Bolívar",
  "Santa Helena del Opón, Santander",
  "Santa Isabel, Tolima",
  "Santa Lucía, Atlántico",
  "Santa Marta, Magdalena",
  "Santa María, Boyacá",
  "Santa María, Huila",
  "Santa Rosa de Cabal, Risaralda",
  "Santa Rosa de Osos, Antioquia",
  "Santa Rosa de Viterbo, Boyacá",
  "Santa Rosa del Sur, Bolívar",
  "Santa Rosa, Bolívar",
  "Santa Rosa, Cauca",
  "Santa Rosalía, Vichada",
  "Santa Sofía, Boyacá",
  "Santacruz, Nariño",
  "Santana, Boyacá",
  "Santander de Quilichao, Boyacá",
  "Santander de Quilichao, Cauca",
  "Santiago de Tolú, Sucre",
  "Santiago, Norte de Santander",
  "Santiago, Putumayo",
  "Santo Domingo, Antioquia",
  "Santo Tomás, Atlántico",
  "Santuario, Risaralda",
  "Sapuyes, Nariño",
  "Saravena, Arauca",
  "Sardinata, Norte de Santander",
  "Sasaima, Cundinamarca",
  "Sativanorte, Boyacá",
  "Sativasur, Boyacá",
  "Segovia, Antioquia",
  "Sesquilé, Cundinamarca",
  "Sevilla, Valle del Cauca",
  "Siachoque, Boyacá",
  "Sibaté, Cundinamarca",
  "Sibundoy, Putumayo",
  "Silos, Norte de Santander",
  "Silvania, Cundinamarca",
  "Silvia, Cauca",
  "Simacota, Santander",
  "Simijaca, Cundinamarca",
  "Simití, Bolívar",
  "Sincelejo, Sucre",
  "Sincé, Sucre",
  "Sipí, Chocó",
  "Sitionuevo, Magdalena",
  "Soacha, Cundinamarca",
  "Soatá, Boyacá",
  "Socha, Boyacá",
  "Socorro, Santander",
  "Socotá, Boyacá",
  "Sogamoso, Boyacá",
  "Solano, Caquetá",
  "Soledad, Atlántico",
  "Solita, Caquetá",
  "Somondoco, Boyacá",
  "Sonsón, Antioquia",
  "Sopetrán, Antioquia",
  "Soplaviento, Bolívar",
  "Sopó, Cundinamarca",
  "Sora, Boyacá",
  "Soracá, Boyacá",
  "Sotaquirá, Boyacá",
  "Sotará, Cauca",
  "Suaita, Santander",
  "Suaza, Huila",
  "Subachoque, Cundinamarca",
  "Sucre, Cauca",
  "Sucre, Santander",
  "Sucre, Sucre",
  "Suesca, Cundinamarca",
  "Supatá, Cundinamarca",
  "Supports, Antioquia",
  "Supía, Caldas",
  "Suratá, Santander",
  "Susa, Cundinamarca",
  "Susacón, Boyacá",
  "Sutamarchán, Boyacá",
  "Sutatausa, Cundinamarca",
  "Sutatenza, Boyacá",
  "Suán, Atlántico",
  "Suárez, Cauca",
  "Suárez, Tolima",
  "Sácama, Casanare",
  "Sáchica, Boyacá",
  "Tabio, Cundinamarca",
  "Tadó, Chocó",
  "Talaigua Nuevo, Bolívar",
  "Tamalameque, Cesar",
  "Tame, Arauca",
  "Taminango, Nariño",
  "Tangua, Nariño",
  "Taraira, Vaupés",
  "Tarapacá, Amazonas",
  "Tarazá, Antioquia",
  "Tarqui, Huila",
  "Tarso, Antioquia",
  "Tasco, Boyacá",
  "Tauramena, Casanare",
  "Tausa, Cundinamarca",
  "Tello, Huila",
  "Tena, Cundinamarca",
  "Tenerife, Magdalena",
  "Tenjo, Cundinamarca",
  "Tenza, Boyacá",
  "Teorama, Norte de Santander",
  "Teruel, Huila",
  "Tesalia, Huila",
  "Tibacuy, Cundinamarca",
  "Tibaná, Boyacá",
  "Tibasosa, Boyacá",
  "Tibirita, Cundinamarca",
  "Tibú, Norte de Santander",
  "Tierralta, Córdoba",
  "Timaná, Huila",
  "Timbiquí, Cauca",
  "Timbío, Cauca",
  "Tinjacá, Boyacá",
  "Tipacoque, Boyacá",
  "Tiquisio, Bolívar",
  "Titiribí, Antioquia",
  "Toca, Boyacá",
  "Tocaima, Cundinamarca",
  "Tocancipá, Cundinamarca",
  "Togüí, Boyacá",
  "Toledo, Antioquia",
  "Toledo, Norte de Santander",
  "Tolú Viejo, Sucre",
  "Tona, Santander",
  "Topaipí, Cundinamarca",
  "Toribío, Cauca",
  "Toro, Valle del Cauca",
  "Tota, Boyacá",
  "Totoró, Cauca",
  "Trinidad, Casanare",
  "Trujillo, Valle del Cauca",
  "Tubará, Atlántico",
  "Tuchín, Córdoba",
  "Tuluá, Valle del Cauca",
  "Tumaco, Nariño",
  "Tunja, Boyacá",
  "Tununguá, Boyacá",
  "Turbaco, Bolívar",
  "Turbaná, Bolívar",
  "Turbo, Antioquia",
  "Turmequé, Boyacá",
  "Tuta, Boyacá",
  "Tutazá, Boyacá",
  "Támara, Casanare",
  "Tópaga, Boyacá",
  "Túquerres, Nariño",
  "Ubalá, Cundinamarca",
  "Ubaque, Cundinamarca",
  "Ulloa, Valle del Cauca",
  "Une, Cundinamarca",
  "Unguía, Chocó",
  "Unión Panamericana, Chocó",
  "Uramita, Antioquia",
  "Uribia, La Guajira",
  "Urrao, Antioquia",
  "Urumita, La Guajira",
  "Usiacurí, Atlántico",
  "Valdivia, Antioquia",
  "Valencia, Córdoba",
  "Valle de San José, Santander",
  "Valle de San Juan, Tolima",
  "Valle del Guamuez, Putumayo",
  "Valledupar, Cesar",
  "Valparaíso, Antioquia",
  "Valparaíso, Caquetá",
  "Vegachí, Antioquia",
  "Venadillo, Tolima",
  "Venecia, Antioquia",
  "Venecia, Cundinamarca",
  "Ventaquemada, Boyacá",
  "Vergara, Cundinamarca",
  "Versalles, Valle del Cauca",
  "Vetas, Santander",
  "Vianí, Cundinamarca",
  "Victoria, Caldas",
  "Vigía del Fuerte, Antioquia",
  "Vijes, Valle del Cauca",
  "Villa Caro, Norte de Santander",
  "Villa de Leyva, Boyacá",
  "Villa del Rosario, Norte de Santander",
  "Villa Rica, Cauca",
  "Villagarzón, Putumayo",
  "Villagómez, Cundinamarca",
  "Villahermosa, Tolima",
  "Villamaría, Caldas",
  "Villanueva, Bolívar",
  "Villanueva, Casanare",
  "Villanueva, La Guajira",
  "Villanueva, Santander",
  "Villapinzón, Cundinamarca",
  "Villarrica, Tolima",
  "Villavicencio, Meta",
  "Villavieja, Huila",
  "Villeta, Cundinamarca",
  "Viotá, Cundinamarca",
  "Viracachá, Boyacá",
  "Vista Hermosa, Meta",
  "Viterbo, Caldas",
  "Vélez, Santander",
  "Yacopí, Cundinamarca",
  "Yacuanquer, Nariño",
  "Yaguará, Huila",
  "Yalí, Antioquia",
  "Yarumal, Antioquia",
  "Yavaraté, Vaupés",
  "Yolombó, Antioquia",
  "Yondó, Antioquia",
  "Yopal, Casanare",
  "Yotoco, Valle del Cauca",
  "Yumbo, Valle del Cauca",
  "Zambrano, Bolívar",
  "Zapatoca, Santander",
  "Zapayán, Magdalena",
  "Zaragoza, Antioquia",
  "Zarzal, Valle del Cauca",
  "Zetaquira, Boyacá",
  "Zipacón, Cundinamarca",
  "Zipaquirá, Cundinamarca",
  "Zona Bananera, Magdalena",
  "Ábrego, Norte de Santander",
  "Úmbita, Boyacá",
  "Útica, Cundinamarca",
];

/* ══════════════════════════════════════════════════════════════
   DROPDOWN — ColombiaCiudades
   Funciona como un <select> nativo pero con buscador interno.
   Click en el campo → se despliega lista completa + buscador.
══════════════════════════════════════════════════════════════ */
const ColombiaCiudades = (() => {

  /**
   * init(inputId, opciones)
   * Reemplaza el <input id="inputId"> por un dropdown estilo select
   * con buscador interno y todos los municipios de Colombia.
   *
   * @param {string} inputId   ID del input original (se oculta y se usa como campo oculto)
   * @param {object} opciones  { placeholder, onSelect }
   */
  function init(inputId, opciones = {}) {
    const inputOculto = document.getElementById(inputId);
    if (!inputOculto) { console.error(`ColombiaCiudades: no encontré #${inputId}`); return; }

    const cfg = {
      placeholder: opciones.placeholder || "Selecciona tu ciudad o municipio...",
      onSelect:    opciones.onSelect     || null,
    };

    // Ocultar input original (guarda el valor seleccionado)
    inputOculto.type  = "hidden";
    inputOculto.value = "";

    // ── Estructura del dropdown ──────────────────────────────
    //
    //  <div class="cc-wrapper">
    //    <input type="hidden" id="campo-ciudad" />   ← valor real
    //    <button class="cc-trigger">                 ← lo que ve el usuario
    //      <span class="cc-label">Selecciona...</span>
    //      <svg chevron />
    //    </button>
    //    <div class="cc-panel">                      ← panel flotante
    //      <div class="cc-buscar-wrap">
    //        <input class="cc-buscar" placeholder="Buscar..." />
    //      </div>
    //      <ul class="cc-lista" role="listbox">...</ul>
    //    </div>
    //  </div>

    const wrapper = document.createElement("div");
    wrapper.className = "cc-wrapper";
    inputOculto.parentNode.insertBefore(wrapper, inputOculto);
    wrapper.appendChild(inputOculto);

    // Botón trigger (simula el <select>)
    const trigger = document.createElement("button");
    trigger.type      = "button";
    trigger.className = "cc-trigger";
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");
    trigger.innerHTML = `
      <span class="cc-label cc-placeholder">${_esc(cfg.placeholder)}</span>
      <svg class="cc-chevron" width="16" height="16" viewBox="0 0 16 16" fill="none"
           stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="4 6 8 10 12 6"/>
      </svg>`;
    wrapper.appendChild(trigger);

    // Panel flotante
    const panel = document.createElement("div");
    panel.className = "cc-panel";
    panel.style.display = "none";
    panel.innerHTML = `
      <div class="cc-buscar-wrap">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor"
             stroke-width="2" stroke-linecap="round">
          <circle cx="6.5" cy="6.5" r="4.5"/><line x1="10.5" y1="10.5" x2="14" y2="14"/>
        </svg>
        <input class="cc-buscar" type="text" placeholder="Buscar ciudad o municipio..." autocomplete="off" />
      </div>
      <ul class="cc-lista" role="listbox"></ul>`;
    wrapper.appendChild(panel);

    const labelEl  = trigger.querySelector(".cc-label");
    const buscar   = panel.querySelector(".cc-buscar");
    const lista    = panel.querySelector(".cc-lista");

    _inyectarEstilos();

    let abierto        = false;
    let indiceActivo   = -1;
    let itemsVisibles  = [];

    // ── Renderizar lista ─────────────────────────────────────
    function renderizar(q) {
      const qNorm = _normalizar(q || "");
      itemsVisibles = q
        ? MUNICIPIOS_COLOMBIA.filter(c => _normalizar(c).includes(qNorm))
        : MUNICIPIOS_COLOMBIA;

      lista.innerHTML = "";
      indiceActivo    = -1;

      if (itemsVisibles.length === 0) {
        lista.innerHTML = `<li class="cc-vacio">Sin resultados para "${_esc(q)}"</li>`;
        return;
      }

      itemsVisibles.forEach((ciudad, i) => {
        const li = document.createElement("li");
        li.className = "cc-item";
        li.setAttribute("role", "option");
        li.innerHTML  = q ? _resaltar(ciudad, q) : _esc(ciudad);
        li.addEventListener("mousedown", e => { e.preventDefault(); seleccionar(ciudad); });
        lista.appendChild(li);
      });
    }

    // ── Abrir / cerrar ────────────────────────────────────────
    function abrir() {
      abierto = true;
      panel.style.display = "block";
      trigger.setAttribute("aria-expanded", "true");
      trigger.classList.add("cc-trigger--abierto");
      buscar.value = "";
      renderizar("");

      // Scroll al ítem seleccionado
      const val = inputOculto.value;
      if (val) {
        const idx = MUNICIPIOS_COLOMBIA.indexOf(val);
        if (idx >= 0) {
          const li = lista.children[idx];
          if (li) {
            li.classList.add("cc-item--activo");
            indiceActivo = idx;
            setTimeout(() => li.scrollIntoView({ block: "center" }), 10);
          }
        }
      }

      setTimeout(() => buscar.focus(), 30);
    }

    function cerrar() {
      abierto = false;
      panel.style.display = "none";
      trigger.setAttribute("aria-expanded", "false");
      trigger.classList.remove("cc-trigger--abierto");
    }

    function seleccionar(ciudad) {
      inputOculto.value = ciudad;
      labelEl.textContent = ciudad;
      labelEl.classList.remove("cc-placeholder");
      cerrar();
      if (cfg.onSelect) cfg.onSelect(ciudad);
      inputOculto.dispatchEvent(new Event("change", { bubbles: true }));
    }

    // ── Resaltar ítem activo ──────────────────────────────────
    function resaltar() {
      [...lista.querySelectorAll(".cc-item")].forEach((li, i) => {
        li.classList.toggle("cc-item--activo", i === indiceActivo);
        if (i === indiceActivo) li.scrollIntoView({ block: "nearest" });
      });
    }

    // ── Eventos ───────────────────────────────────────────────
    trigger.addEventListener("click", () => abierto ? cerrar() : abrir());

    buscar.addEventListener("input", () => renderizar(buscar.value.trim()));

    buscar.addEventListener("keydown", e => {
      const items = lista.querySelectorAll(".cc-item");
      if (e.key === "ArrowDown") {
        e.preventDefault();
        indiceActivo = Math.min(indiceActivo + 1, items.length - 1);
        resaltar();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        indiceActivo = Math.max(indiceActivo - 1, -1);
        resaltar();
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (indiceActivo >= 0 && itemsVisibles[indiceActivo]) {
          seleccionar(itemsVisibles[indiceActivo]);
        }
      } else if (e.key === "Escape") {
        cerrar();
        trigger.focus();
      }
    });

    // Cerrar al hacer click fuera
    document.addEventListener("mousedown", e => {
      if (abierto && !wrapper.contains(e.target)) cerrar();
    });
  }

  // ── Helpers ──────────────────────────────────────────────────
  function _normalizar(s) {
    return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  function _resaltar(texto, query) {
    const norm  = _normalizar(texto);
    const qNorm = _normalizar(query);
    const idx   = norm.indexOf(qNorm);
    if (idx === -1) return _esc(texto);
    return (
      _esc(texto.slice(0, idx)) +
      `<mark>${_esc(texto.slice(idx, idx + query.length))}</mark>` +
      _esc(texto.slice(idx + query.length))
    );
  }

  function _esc(s) {
    return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  }

  function _inyectarEstilos() {
    if (document.getElementById("cc-styles")) return;
    const s = document.createElement("style");
    s.id = "cc-styles";
    s.textContent = `
      .cc-wrapper { position: relative; }

      /* ── Trigger (botón que simula el select) ── */
      .cc-trigger {
        width: 100%; display: flex; align-items: center; justify-content: space-between;
        gap: .5rem; padding: .7rem .95rem;
        background: #fafafa; border: 1.5px solid #d1d5db; border-radius: 10px;
        cursor: pointer; font-family: inherit; font-size: .95rem;
        color: #1a2e22; text-align: left;
        transition: border-color .15s, box-shadow .15s;
      }
      .cc-trigger:hover { border-color: #9ca3af; }
      .cc-trigger:focus { outline: none; border-color: #2d9e5f; box-shadow: 0 0 0 3px rgba(45,158,95,.15); }
      .cc-trigger--abierto {
        border-color: #2d9e5f;
        box-shadow: 0 0 0 3px rgba(45,158,95,.15);
        background: #fff;
      }
      .cc-placeholder { color: #b0b8c1; }
      .cc-label { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .cc-chevron {
        flex-shrink: 0; color: #6b7280;
        transition: transform .2s;
      }
      .cc-trigger--abierto .cc-chevron { transform: rotate(180deg); }

      /* ── Panel flotante ── */
      .cc-panel {
        position: absolute; top: calc(100% + 4px); left: 0; right: 0; z-index: 99999;
        background: #fff; border: 1.5px solid #d1d5db; border-radius: 12px;
        box-shadow: 0 12px 32px rgba(0,0,0,.14);
        overflow: hidden;
      }

      /* ── Buscador interno ── */
      .cc-buscar-wrap {
        display: flex; align-items: center; gap: .5rem;
        padding: .6rem .8rem;
        border-bottom: 1px solid #f0f0f0;
        background: #fafafa;
      }
      .cc-buscar-wrap svg { flex-shrink: 0; color: #9ca3af; }
      .cc-buscar {
        flex: 1; border: none; outline: none; background: transparent;
        font-family: inherit; font-size: .9rem; color: #1a2e22;
      }
      .cc-buscar::placeholder { color: #b0b8c1; }

      /* ── Lista ── */
      .cc-lista {
        max-height: 220px; overflow-y: auto;
        margin: 0; padding: .3rem 0; list-style: none;
        font-family: 'Segoe UI', system-ui, sans-serif; font-size: .92rem;
      }
      .cc-item {
        padding: .52rem 1rem; cursor: pointer; color: #1a2e22;
        transition: background .1s; line-height: 1.4;
      }
      .cc-item:hover, .cc-item--activo { background: #e8f5ee; color: #1a6b3c; }
      .cc-item mark { background: transparent; color: #1a6b3c; font-weight: 700; text-decoration: underline; }
      .cc-vacio { padding: .8rem 1rem; color: #9ca3af; font-size: .88rem; font-style: italic; }

      /* scrollbar */
      .cc-lista::-webkit-scrollbar { width: 5px; }
      .cc-lista::-webkit-scrollbar-track { background: transparent; }
      .cc-lista::-webkit-scrollbar-thumb { background: #d1ead9; border-radius: 999px; }
    `;
    document.head.appendChild(s);
  }

  return { init };

})();


/* ══════════════════════════════════════════════════════════════
   MODAL — SOLICITAR REGISTRO
══════════════════════════════════════════════════════════════ */
(() => {

  const DESTINO = "aplicativosawebs+gistore@gmail.com";

  const $  = id => document.getElementById(id);

  // ── Modal: abrir / cerrar ────────────────────────────────────
  function abrirModal() {
    $("modalOverlay").classList.add("abierto");
    document.body.style.overflow = "hidden";

    if (!window._ccIniciado) {
      ColombiaCiudades.init("campo-ciudad", {
        placeholder: "Escribe tu ciudad o municipio...",
        maxResultados: 8,
      });
      window._ccIniciado = true;
    }

    $("campo-tienda").focus();
  }

  function cerrarModal() {
    $("modalOverlay").classList.remove("abierto");
    document.body.style.overflow = "";

    setTimeout(() => {
      $("modalFormulario").style.display = "";
      $("modalExito").style.display      = "none";
      $("modalExito").style.flexDirection = "";
      ["campo-tienda","campo-ciudad","campo-correo","campo-whatsapp"]
        .forEach(id => { $(id).value = ""; });
      // Resetear el label visual del dropdown de ciudad
      const trigger = document.querySelector(".cc-trigger .cc-label");
      if (trigger) {
        trigger.textContent = "Selecciona tu ciudad o municipio...";
        trigger.classList.add("cc-placeholder");
      }
      ocultarError();
      setLoading(false);
    }, 300);
  }

  // ── Error / loading ──────────────────────────────────────────
  function mostrarError(msg) {
    $("modalError").textContent = msg || "Por favor completa todos los campos.";
    $("modalError").classList.add("visible");
  }

  function ocultarError() {
    $("modalError").classList.remove("visible");
  }

  function setLoading(on) {
    $("btnEnviar").disabled    = on;
    $("btnTexto").textContent  = on ? "Enviando..." : "Enviar solicitud";
    $("spinner").style.display = on ? "block" : "none";
  }

  // ── Validaciones ─────────────────────────────────────────────
  const validarEmail = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  const validarTel   = t => /^\d{7,15}$/.test(t.replace(/\s/g, ""));

  // ── Envío ────────────────────────────────────────────────────
  async function enviarFormulario() {
    ocultarError();

    const tienda   = $("campo-tienda").value.trim();
    const ciudad   = $("campo-ciudad").value.trim();
    const correo   = $("campo-correo").value.trim();
    const whatsapp = $("campo-whatsapp").value.trim();

    if (!tienda)                           return mostrarError("El nombre de la tienda o tu nombre es requerido.");
    if (!ciudad)                           return mostrarError("Indica tu ciudad o municipio.");
    if (!correo || !validarEmail(correo))  return mostrarError("Ingresa un correo electrónico válido.");
    if (!whatsapp || !validarTel(whatsapp))return mostrarError("Ingresa un número de WhatsApp válido (solo dígitos).");

    setLoading(true);

    const asunto = encodeURIComponent("Solicitud de registro — GI Store");
    const cuerpo = encodeURIComponent(
      `Hola, quiero solicitar mi registro en GI Store.\n\n` +
      `🏪 Tienda / Nombre: ${tienda}\n` +
      `🌆 Ciudad: ${ciudad}\n` +
      `📧 Correo: ${correo}\n` +
      `📱 WhatsApp: +57 ${whatsapp}`
    );

    await new Promise(r => setTimeout(r, 800));
    window.location.href = `mailto:${DESTINO}?subject=${asunto}&body=${cuerpo}`;

    $("modalFormulario").style.display   = "none";
    $("modalExito").style.display        = "flex";
    $("modalExito").style.flexDirection  = "column";
    setLoading(false);
  }

  // ── Bind de eventos al cargar el DOM ─────────────────────────
  document.addEventListener("DOMContentLoaded", () => {

    $("btnSolicitarRegistro")?.addEventListener("click", abrirModal);
    $("btnCerrar")           ?.addEventListener("click", cerrarModal);
    $("btnExitoCerrar")      ?.addEventListener("click", cerrarModal);
    $("btnEnviar")           ?.addEventListener("click", enviarFormulario);

    $("modalOverlay")?.addEventListener("click", e => {
      if (e.target === e.currentTarget) cerrarModal();
    });

    document.addEventListener("keydown", e => {
      if (e.key === "Escape") cerrarModal();
    });

  });

})();