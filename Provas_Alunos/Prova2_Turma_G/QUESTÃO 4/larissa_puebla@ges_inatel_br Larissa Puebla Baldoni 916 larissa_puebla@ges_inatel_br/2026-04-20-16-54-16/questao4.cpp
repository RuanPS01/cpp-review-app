#include <iostream>

using namespace std;
int main ()

{
   int i = 0;
   int j;
   int encontrado;
   int posicao;
   double numeros[1000];
   double pesquisa;
   double numero = 1;
   
   while (numero != 0){
       
       cin >> numero;
       
       if (numero != 0){
           numeros[i] = numero;
           i++;
       }
   }
   
   cin >> pesquisa;
   
   for (j = 0; j < i; j++){
       if (numeros[j] == pesquisa){
           encontrado = 1;
           posicao = j;
           j = i;
       }
       else{
           encontrado = 0;
       }
   }
   
    if (encontrado == 1){
          cout << pesquisa << " encontrado na posicao " << posicao << endl;
    }
    else if (encontrado == 0){
        cout << "Elemento nao encontrado" << endl;
    }
    
    return 0;
}