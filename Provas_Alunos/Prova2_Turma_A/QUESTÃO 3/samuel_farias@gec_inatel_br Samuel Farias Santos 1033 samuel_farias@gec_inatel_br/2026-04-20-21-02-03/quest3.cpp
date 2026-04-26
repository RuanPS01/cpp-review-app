#include <iostream>
using namespace std;

int main(){
   int vetor[100], M, soma;
   cin >> M;
   int indice = 0;
   int contador = 0;
   
   while (M != 0){
       if( M == 10){
           
           contador ++;
       }
       
       vetor[indice] = M;
        indice++; 
        cin >> M;
        soma = soma + M;
       
   }
    cout << "Total de moedas: " << soma + vetor [0]<< endl;
    cout <<"Cavernas com 10 moedas: "<< contador << endl;
    
   return 0;
}