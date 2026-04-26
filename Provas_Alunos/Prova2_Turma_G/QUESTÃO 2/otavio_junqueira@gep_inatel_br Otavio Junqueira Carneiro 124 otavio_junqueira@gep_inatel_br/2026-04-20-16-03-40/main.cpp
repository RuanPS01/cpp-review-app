#include <iostream>
#include <iomanip>
using namespace std;

int main ()
{
    int N;
    cin >> N;
    
    int inteiros[999];
    double media =0, soma= 0;
    
    for(int i =0; i< N; i++)
    {
        cin>> inteiros[i];
         soma += inteiros[i];
    }
    
    media = soma / N;
    
    cout << fixed << setprecision(4);
    cout << media << endl;
    
    
   return 0; 
   
    
}