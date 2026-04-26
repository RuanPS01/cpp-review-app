#include <iostream>
#include <iomanip>
using namespace std;
int main () {
    
    int n,num;
   double x,soma = 0;
   
   cin >> num >> n;
   
   for (int i = 0; i < n; i++) {
       cin >> x >> num;
       soma +=num;
       
   }
        cin >> x;
       
    double media = (double)soma / num; 
    

    cout << fixed << setprecision(4);
    cout << media << endl;
    return 0;
}