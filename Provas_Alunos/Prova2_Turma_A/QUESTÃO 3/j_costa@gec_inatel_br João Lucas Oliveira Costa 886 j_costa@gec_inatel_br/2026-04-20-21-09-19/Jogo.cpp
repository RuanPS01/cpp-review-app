#include <iostream>
using namespace std;

int main()
{
    
    int C;
    
    int moedas;
    cin >> moedas;
    
    int C10m = 0;
    int total;
    int soma = 0;
    
    cin >> total;
    total = soma;
   
   for ( int i = 0; i < C; i++ ) {
       cin >> C >> moedas;
       if ( moedas == 0 ) {
           break;
       }
   }
   
   for ( int i = 0; i < C; i++ ) {
       cin >> C >> moedas;
       if ( moedas == 10 ) {
           soma += moedas;
           C10m++;
       } else if ( moedas > 0 && moedas < 10 ) {
           soma += moedas;
       }
   }
   
    
    cout << "Total de moedas: " << total << endl;
    cout << "Cavernas com 10 moedas: " << C10m;
    
    return 0;
}